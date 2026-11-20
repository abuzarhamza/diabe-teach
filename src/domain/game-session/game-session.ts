import type { ConceptChain, GridCoord } from "./concept-chain.js";
import type {
  AdjudicationMode,
  AssessmentAttempt,
  AssessmentStage,
  ChainViewer,
  GameSessionProps,
  LikertRating,
  McqAnswerChoice,
  Participant,
  PhaseIdentifier,
  SessionMode,
  SessionTimerConfig,
  SurveyResponse,
} from "./game-session.types.js";
import type { RoundBoard } from "./round-board.types.js";
import { randomUUID } from "node:crypto";
import {
  AssessmentAlreadySubmittedError,
  ChainAlreadySubmittedError,
  InvalidPhaseTransitionError,
  InvalidTimerConfigError,
  PhaseClosedForSubmissionsError,
  SurveyAlreadySubmittedError,
} from "../errors/domain-errors.js";
import { BoardDealer } from "./board-dealer.js";
import {
  DEFAULT_TIMER_CONFIG,
  MAX_TIMER_DURATION_SEC,
  PHASE_GAMEPLAY_ROUND,
  PHASE_TIMER_FIELD,
  PHASE_TRANSITIONS,
  SUBMISSION_GRACE_PERIOD_SEC,
  TIMER_FIELDS,
} from "./game-session.types.js";
import { RoomCode } from "./room-code.js";
import { SessionId } from "./session-id.js";

export class GameSession {
  readonly #sessionId: SessionId;
  readonly #roomCode: RoomCode;
  readonly #packId: string;
  readonly #packVersion: string | null;
  readonly #ownerAccountId: string | null;
  readonly #mode: SessionMode;
  readonly #adjudicationMode: AdjudicationMode;
  readonly #timerConfig: SessionTimerConfig;
  readonly #createdAt: Date;
  readonly #participants: Participant[];
  readonly #chains: ConceptChain[];
  /** Assessment Attempts keyed by participant, then by stage. */
  readonly #assessments: Map<string, Map<AssessmentStage, AssessmentAttempt>>;
  /** Perception survey responses keyed by participant. */
  readonly #surveyResponses: Map<string, SurveyResponse>;
  readonly #creationSeed: string | null;
  /** Each Gameplay Round's dealt board, keyed by round number. */
  readonly #roundBoards: Map<1 | 2, RoundBoard>;
  readonly #version: number;

  #currentPhase: PhaseIdentifier;
  #phaseStartedAt: Date;
  #activeRoundNumber: 1 | 2 | null;

  private constructor(props: GameSessionProps) {
    this.#sessionId = props.sessionId instanceof SessionId
      ? props.sessionId
      : props.sessionId
        ? SessionId.from(props.sessionId)
        : SessionId.generate();

    this.#roomCode = props.roomCode instanceof RoomCode
      ? props.roomCode
      : props.roomCode
        ? RoomCode.from(props.roomCode)
        : RoomCode.generate();

    this.#packId = props.packId;
    this.#packVersion = props.packVersion ?? null;
    this.#ownerAccountId = props.ownerAccountId ?? null;
    this.#mode = props.mode;
    this.#adjudicationMode = props.adjudicationMode;
    this.#timerConfig = GameSession.#resolveTimerConfig(props.timerConfig);
    this.#currentPhase = props.currentPhase ?? "pretest";
    this.#phaseStartedAt = props.phaseStartedAt ?? new Date();
    this.#participants = props.participants
      ? [...props.participants]
      : [];
    this.#activeRoundNumber = props.activeRoundNumber ?? null;
    this.#createdAt = props.createdAt ?? new Date();
    this.#creationSeed = props.creationSeed ?? null;
    this.#roundBoards = new Map(
      (props._roundBoards ?? []).map(board => [board.roundNumber, board]),
    );
    this.#version = props.version ?? 0;
    // Support rehydration from persistence with existing chains
    this.#chains = props._chains
      ? [...props._chains]
      : [];
    // Support rehydration from persistence with existing assessments
    this.#assessments = new Map();
    for (const attempt of props._assessments ?? []) {
      this.#recordAssessment(attempt);
    }
    // Support rehydration from persistence with existing survey responses
    this.#surveyResponses = new Map();
    for (const response of props._surveyResponses ?? []) {
      this.#surveyResponses.set(response.participantId, response);
    }
  }

  /**
   * Starts a new session at version 0. Rejects an invalid timer config with
   * InvalidTimerConfigError, and a creation seed that is not a non-empty
   * string with InvalidBoardSeedError.
   */
  public static create(props: GameSessionProps): GameSession {
    GameSession.#assertValidTimerConfig(props.timerConfig);
    BoardDealer.assertValidSeed(props.creationSeed ?? undefined, "seed");
    return new GameSession({ ...props, version: 0 });
  }

  /**
   * Restores a stored session as it was saved, without create-time
   * validation, so sessions saved under older rules still load.
   */
  public static rehydrate(props: GameSessionProps): GameSession {
    return new GameSession(props);
  }

  public get sessionId(): SessionId {
    return this.#sessionId;
  }

  public get roomCode(): RoomCode {
    return this.#roomCode;
  }

  public get packId(): string {
    return this.#packId;
  }

  /** The pinned Pack Version, or `null` for sessions stored before pinning. */
  public get packVersion(): string | null {
    return this.#packVersion;
  }

  /**
   * The Instructor Account that started the session: set for classroom
   * sessions, `null` for solo sessions and for sessions stored before
   * accounts existed.
   */
  public get ownerAccountId(): string | null {
    return this.#ownerAccountId;
  }

  public get mode(): SessionMode {
    return this.#mode;
  }

  public get adjudicationMode(): AdjudicationMode {
    return this.#adjudicationMode;
  }

  public get timerConfig(): SessionTimerConfig {
    return this.#timerConfig;
  }

  public get currentPhase(): PhaseIdentifier {
    return this.#currentPhase;
  }

  public get phaseStartedAt(): Date {
    return this.#phaseStartedAt;
  }

  /**
   * When the current phase is scheduled to end, derived from this session's
   * own timer config. Phases without a configured duration (round summaries,
   * completed) end the moment they start. `null` means the phase is
   * instructor-driven (its timer is set to `null`) and has no deadline.
   */
  public get phaseEndsAt(): Date | null {
    const durationSec = this.#currentPhaseDurationSec();
    if (durationSec === null) {
      return null;
    }
    return new Date(this.#phaseStartedAt.getTime() + durationSec * 1000);
  }

  public get participantCount(): number {
    return this.#participants.length;
  }

  public get participants(): readonly Participant[] {
    return this.#participants;
  }

  public get activeRoundNumber(): 1 | 2 | null {
    return this.#activeRoundNumber;
  }

  public get createdAt(): Date {
    return this.#createdAt;
  }

  /** The seed given at creation for Round 1's board, or `null`. */
  public get creationSeed(): string | null {
    return this.#creationSeed;
  }

  /**
   * The board of the Gameplay Round the current phase belongs to, from its
   * Chain-Mapping through its Round-Summary. `null` outside the rounds, and
   * for a round entered before boards were dealt (legacy sessions).
   */
  public get activeBoard(): RoundBoard | null {
    const roundNumber = PHASE_GAMEPLAY_ROUND[this.#currentPhase];
    return roundNumber === null
      ? null
      : this.boardForRound(roundNumber);
  }

  /** The board dealt for a Gameplay Round, or `null` if none was dealt. */
  public boardForRound(roundNumber: 1 | 2): RoundBoard | null {
    return this.#roundBoards.get(roundNumber) ?? null;
  }

  /** Every dealt round board, in round order, for persistence. */
  public get roundBoards(): readonly RoundBoard[] {
    return [
      ...this.#roundBoards.values(),
    ].sort((a, b) => a.roundNumber - b.roundNumber);
  }

  /**
   * The Gameplay Round whose board must be dealt on entering `phase`: 1 or 2
   * for a round's Chain-Mapping phase, otherwise `null`.
   */
  public static roundEnteredBy(phase: PhaseIdentifier): 1 | 2 | null {
    if (phase === "round-1:chain-mapping") {
      return 1;
    }
    if (phase === "round-2:chain-mapping") {
      return 2;
    }
    return null;
  }

  /**
   * The stored version this session was loaded at (0 for a new session).
   * A save succeeds only while the stored session is still at this version.
   */
  public get version(): number {
    return this.#version;
  }

  /**
   * Moves to the next phase. Entering a round's Chain-Mapping phase stores
   * `board` as that round's board; `board` must be dealt for that round and
   * is not allowed for any other phase. Entering a round without a board
   * leaves the round without one, as in sessions stored before boards.
   */
  public transitionTo(targetPhase: PhaseIdentifier, now: Date, board?: RoundBoard): void {
    const allowedNext = PHASE_TRANSITIONS.get(this.#currentPhase);

    if (allowedNext !== targetPhase) {
      throw new InvalidPhaseTransitionError(this.#currentPhase, targetPhase);
    }

    const enteredRound = GameSession.roundEnteredBy(targetPhase);
    if (board !== undefined && board.roundNumber !== enteredRound) {
      throw new Error(
        `A board for round ${board.roundNumber} cannot be stored on entering phase '${targetPhase}'.`,
      );
    }

    this.#currentPhase = targetPhase;
    this.#phaseStartedAt = now;

    if (enteredRound !== null) {
      this.#activeRoundNumber = enteredRound;
      if (board !== undefined) {
        this.#roundBoards.set(enteredRound, board);
      }
    }
  }

  public addParticipant(displayName: string): Participant {
    const participant: Participant = {
      participantId: randomUUID(),
      displayName,
      joinedAt: new Date(),
    };

    this.#participants.push(participant);
    return participant;
  }

  public getParticipant(participantId: string): Participant | undefined {
    return this.#participants.find(p => p.participantId === participantId);
  }

  public get chains(): readonly ConceptChain[] {
    return this.#chains;
  }

  /**
   * Records a Concept Chain. Only allowed during a Chain-Mapping phase, for
   * the active round, and no later than `phaseEndsAt` plus the submission
   * grace period. An expired phase stays current (closed) until the
   * instructor transitions it. An instructor-driven phase (no `phaseEndsAt`)
   * accepts chains until then.
   */
  public addChain(chain: ConceptChain, now: Date): void {
    if (!this.isChainMappingPhase()) {
      throw new PhaseClosedForSubmissionsError(this.#currentPhase);
    }
    if (chain.roundNumber !== this.#activeRoundNumber) {
      throw new PhaseClosedForSubmissionsError(this.#currentPhase, {
        requestedRoundNumber: chain.roundNumber,
        activeRoundNumber: this.#activeRoundNumber,
      });
    }
    const phaseEndsAt = this.phaseEndsAt;
    if (phaseEndsAt === null) {
      this.#recordChain(chain);
      return;
    }
    const closesAtMs = phaseEndsAt.getTime() + SUBMISSION_GRACE_PERIOD_SEC * 1000;
    if (now.getTime() > closesAtMs) {
      throw new PhaseClosedForSubmissionsError(this.#currentPhase, {
        phaseEndsAt,
        gracePeriodSec: SUBMISSION_GRACE_PERIOD_SEC,
      });
    }
    this.#recordChain(chain);
  }

  public getChain(chainId: string): ConceptChain | undefined {
    return this.#chains.find(c => c.chainId === chainId);
  }

  public getChainsForRound(roundNumber: 1 | 2): readonly ConceptChain[] {
    return this.#chains.filter(c => c.roundNumber === roundNumber);
  }

  /**
   * The Concept Chains of a Gameplay Round that `viewer` may see, sorted by
   * submission time, then chain id. The instructor sees every chain; a
   * participant sees only their own (in every phase, for now).
   */
  public getChainsForRoundVisibleTo(
    roundNumber: 1 | 2,
    viewer: ChainViewer,
  ): readonly ConceptChain[] {
    const visible = this.getChainsForRound(roundNumber).filter(
      chain => viewer.role === "instructor"
        || (viewer.participantId !== undefined
          && chain.participantId === viewer.participantId),
    );
    return [...visible].sort((a, b) => {
      const timeDiff = a.submittedAt.getTime() - b.submittedAt.getTime();
      if (timeDiff !== 0)
        return timeDiff;
      return a.chainId < b.chainId
        ? -1
        : a.chainId > b.chainId
          ? 1
          : 0;
    });
  }

  public isChainMappingPhase(): boolean {
    return (
      this.#currentPhase === "round-1:chain-mapping"
      || this.#currentPhase === "round-2:chain-mapping"
    );
  }

  /** Every participant's Assessment Attempts, for persistence. */
  public get assessmentAttempts(): readonly AssessmentAttempt[] {
    const attempts: AssessmentAttempt[] = [];
    for (const byStage of this.#assessments.values()) {
      attempts.push(...byStage.values());
    }
    return attempts;
  }

  public submitAssessment(
    participantId: string,
    stage: AssessmentStage,
    answers: ReadonlyMap<string, McqAnswerChoice>,
  ): AssessmentAttempt {
    if (this.getAssessment(participantId, stage)) {
      throw new AssessmentAlreadySubmittedError(participantId, stage);
    }

    const attempt: AssessmentAttempt = {
      participantId,
      stage,
      answers,
      submittedAt: new Date(),
    };

    this.#recordAssessment(attempt);
    return attempt;
  }

  #recordAssessment(attempt: AssessmentAttempt): void {
    let byStage = this.#assessments.get(attempt.participantId);
    if (!byStage) {
      byStage = new Map();
      this.#assessments.set(attempt.participantId, byStage);
    }
    byStage.set(attempt.stage, attempt);
  }

  public getAssessment(
    participantId: string,
    stage: AssessmentStage,
  ): AssessmentAttempt | undefined {
    return this.#assessments.get(participantId)?.get(stage);
  }

  /** Every participant's perception survey response, for persistence. */
  public get surveyResponses(): readonly SurveyResponse[] {
    return Array.from(this.#surveyResponses.values());
  }

  public submitSurvey(
    participantId: string,
    responses: ReadonlyMap<string, LikertRating>,
    comments?: string,
  ): SurveyResponse {
    if (this.#surveyResponses.has(participantId)) {
      throw new SurveyAlreadySubmittedError(participantId, this.#sessionId.value);
    }

    const surveyResponse: SurveyResponse = {
      participantId,
      responses,
      ...(comments !== undefined && { comments }),
      submittedAt: new Date(),
    };

    this.#surveyResponses.set(participantId, surveyResponse);
    return surveyResponse;
  }

  public getSurveyResponse(participantId: string): SurveyResponse | undefined {
    return this.#surveyResponses.get(participantId);
  }

  /**
   * Fills omitted timer fields from the defaults. An explicit `null` is kept
   * (instructor-driven phase). Does not validate: stored sessions are loaded
   * as they were saved.
   */
  static #resolveTimerConfig(
    overrides: Partial<SessionTimerConfig> | undefined,
  ): SessionTimerConfig {
    const resolved: Record<keyof SessionTimerConfig, number | null> = { ...DEFAULT_TIMER_CONFIG };
    for (const field of TIMER_FIELDS) {
      const value = overrides?.[field];
      if (value !== undefined) {
        resolved[field] = value;
      }
    }
    return resolved;
  }

  /**
   * A new session's timer config may only name known fields, each either
   * `null` (instructor-driven) or a whole number of seconds from 1 up to
   * MAX_TIMER_DURATION_SEC.
   */
  static #assertValidTimerConfig(timerConfig: unknown): void {
    if (timerConfig === undefined) {
      return;
    }
    if (timerConfig === null || typeof timerConfig !== "object" || Array.isArray(timerConfig)) {
      throw new InvalidTimerConfigError("timerConfig", timerConfig);
    }
    for (const [field, value] of Object.entries(timerConfig)) {
      if (!(TIMER_FIELDS as readonly string[]).includes(field)) {
        throw new InvalidTimerConfigError(field, value);
      }
      const isValidDuration = Number.isInteger(value)
        && (value as number) >= 1
        && (value as number) <= MAX_TIMER_DURATION_SEC;
      if (value !== null && !isValidDuration) {
        throw new InvalidTimerConfigError(field, value);
      }
    }
  }

  #currentPhaseDurationSec(): number | null {
    const field = PHASE_TIMER_FIELD[this.#currentPhase];
    if (field === null) {
      return 0;
    }
    return this.#timerConfig[field];
  }

  /**
   * Appends a chain unless its participant already submitted the same chain
   * in the same round: the same cells in the same or exactly reverse order.
   * The narrative and keywords are ignored. Other participants may submit
   * the same chain.
   */
  #recordChain(chain: ConceptChain): void {
    const repeated = this.#chains.find(existing =>
      existing.participantId === chain.participantId
      && existing.roundNumber === chain.roundNumber
      && GameSession.#visitsSameCells(existing.path, chain.path),
    );
    if (repeated) {
      throw new ChainAlreadySubmittedError(chain.participantId, chain.roundNumber, repeated.chainId);
    }
    this.#chains.push(chain);
  }

  static #visitsSameCells(a: readonly GridCoord[], b: readonly GridCoord[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    const sameCell = (p: GridCoord, q: GridCoord) => p.row === q.row && p.col === q.col;
    const forward = a.every((cell, i) => sameCell(cell, b[i]!));
    return forward || a.every((cell, i) => sameCell(cell, b[b.length - 1 - i]!));
  }
}
