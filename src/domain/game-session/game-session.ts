import type { ConceptChain } from "./concept-chain.js";
import type {
  AdjudicationMode,
  AssessmentAttempt,
  AssessmentStage,
  GameSessionProps,
  LikertRating,
  McqAnswerChoice,
  Participant,
  PhaseIdentifier,
  SessionMode,
  SessionTimerConfig,
  SurveyResponse,
} from "./game-session.types.js";
import { randomUUID } from "node:crypto";
import {
  AssessmentAlreadySubmittedError,
  InvalidPhaseTransitionError,
  PhaseClosedForSubmissionsError,
  SurveyAlreadySubmittedError,
} from "../errors/domain-errors.js";
import {
  DEFAULT_TIMER_CONFIG,
  PHASE_TRANSITIONS,
} from "./game-session.types.js";
import { RoomCode } from "./room-code.js";
import { SessionId } from "./session-id.js";

export class GameSession {
  readonly #sessionId: SessionId;
  readonly #roomCode: RoomCode;
  readonly #packId: string;
  readonly #mode: SessionMode;
  readonly #adjudicationMode: AdjudicationMode;
  readonly #timerConfig: SessionTimerConfig;
  readonly #createdAt: Date;
  readonly #participants: Participant[];
  readonly #chains: ConceptChain[];
  readonly #assessments: Map<AssessmentStage, AssessmentAttempt>;

  #surveyResponse: SurveyResponse | null;
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
    this.#mode = props.mode;
    this.#adjudicationMode = props.adjudicationMode;
    this.#timerConfig = {
      ...DEFAULT_TIMER_CONFIG,
      ...props.timerConfig,
    };
    this.#currentPhase = props.currentPhase ?? "pretest";
    this.#phaseStartedAt = props.phaseStartedAt ?? new Date();
    this.#participants = props.participants
      ? [...props.participants]
      : [];
    this.#activeRoundNumber = props.activeRoundNumber ?? null;
    this.#createdAt = props.createdAt ?? new Date();
    // Support rehydration from persistence with existing chains
    this.#chains = props._chains ? [...props._chains] : [];
    // Support rehydration from persistence with existing assessments
    this.#assessments = props._assessments
      ? new Map(props._assessments)
      : new Map();
    // Support rehydration from persistence with existing survey response
    this.#surveyResponse = props._surveyResponse ?? null;
  }

  public static create(props: GameSessionProps): GameSession {
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

  public transitionTo(targetPhase: PhaseIdentifier): void {
    const allowedNext = PHASE_TRANSITIONS.get(this.#currentPhase);

    if (allowedNext !== targetPhase) {
      throw new InvalidPhaseTransitionError(this.#currentPhase, targetPhase);
    }

    this.#currentPhase = targetPhase;
    this.#phaseStartedAt = new Date();

    if (targetPhase === "round-1:chain-mapping") {
      this.#activeRoundNumber = 1;
    }
    else if (targetPhase === "round-2:chain-mapping") {
      this.#activeRoundNumber = 2;
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

  public addChain(chain: ConceptChain): void {
    if (!this.isChainMappingPhase()) {
      throw new PhaseClosedForSubmissionsError(this.#currentPhase);
    }
    this.#chains.push(chain);
  }

  public getChain(chainId: string): ConceptChain | undefined {
    return this.#chains.find(c => c.chainId === chainId);
  }

  public getChainsForRound(roundNumber: 1 | 2): readonly ConceptChain[] {
    return this.#chains.filter(c => c.roundNumber === roundNumber);
  }

  public isChainMappingPhase(): boolean {
    return (
      this.#currentPhase === "round-1:chain-mapping"
      || this.#currentPhase === "round-2:chain-mapping"
    );
  }

  public get assessments(): ReadonlyMap<AssessmentStage, AssessmentAttempt> {
    return this.#assessments;
  }

  public submitAssessment(
    participantId: string,
    stage: AssessmentStage,
    answers: ReadonlyMap<string, McqAnswerChoice>,
  ): AssessmentAttempt {
    if (this.#assessments.has(stage)) {
      const existing = this.#assessments.get(stage)!;
      throw new AssessmentAlreadySubmittedError(existing.participantId, stage);
    }

    const attempt: AssessmentAttempt = {
      participantId,
      stage,
      answers,
      submittedAt: new Date(),
    };

    this.#assessments.set(stage, attempt);
    return attempt;
  }

  public getAssessment(
    participantId: string,
    stage: AssessmentStage,
  ): AssessmentAttempt | undefined {
    const attempt = this.#assessments.get(stage);
    if (attempt && attempt.participantId === participantId) {
      return attempt;
    }
    return undefined;
  }

  public get surveyResponse(): SurveyResponse | null {
    return this.#surveyResponse;
  }

  public submitSurvey(
    participantId: string,
    responses: ReadonlyMap<string, LikertRating>,
    comments?: string,
  ): SurveyResponse {
    if (this.#surveyResponse !== null) {
      throw new SurveyAlreadySubmittedError(
        this.#surveyResponse.participantId,
        this.#sessionId.value,
      );
    }

    const surveyResponse: SurveyResponse = {
      participantId,
      responses,
      ...(comments !== undefined && { comments }),
      submittedAt: new Date(),
    };

    this.#surveyResponse = surveyResponse;
    return surveyResponse;
  }

  public getSurveyResponse(participantId: string): SurveyResponse | undefined {
    if (
      this.#surveyResponse !== null
      && this.#surveyResponse.participantId === participantId
    ) {
      return this.#surveyResponse;
    }
    return undefined;
  }
}
