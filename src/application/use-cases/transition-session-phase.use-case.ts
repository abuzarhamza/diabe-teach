import type { PhaseIdentifier } from "../../domain/game-session/game-session.types.js";
import type { RoundBoard } from "../../domain/game-session/round-board.types.js";
import type { BoardSeedGeneratorPort, SeededRandomPort } from "../ports/board-randomness.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  TransitionSessionPhaseCommand,
  TransitionSessionPhaseDependencies,
  TransitionSessionPhaseResult,
  TransitionSessionPhaseUseCasePort,
} from "../ports/transition-session-phase.port.js";
import {
  ForbiddenRoleError,
  InvalidPhaseTransitionError,
  MalformedRequestBodyError,
  SessionNotFoundError,
} from "../../domain/errors/domain-errors.js";
import { BoardDealer } from "../../domain/game-session/board-dealer.js";
import { GameSession } from "../../domain/game-session/game-session.js";
import { PHASE_TRANSITIONS } from "../../domain/game-session/game-session.types.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";
import { SessionPackLoader } from "../services/session-pack-loader.js";

export class TransitionSessionPhaseUseCase
implements TransitionSessionPhaseUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  /** Reads the session's pinned Pack Version (or the latest, for legacy sessions). */
  readonly #packs: SessionPackLoader;
  readonly #clock: ClockPort;
  readonly #seededRandom: SeededRandomPort;
  readonly #seedGenerator: BoardSeedGeneratorPort;

  public constructor(deps: TransitionSessionPhaseDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#packs = new SessionPackLoader(deps.packRepo);
    this.#clock = deps.clock;
    this.#seededRandom = deps.seededRandom;
    this.#seedGenerator = deps.seedGenerator;
  }

  public async execute(
    command: TransitionSessionPhaseCommand,
  ): Promise<TransitionSessionPhaseResult> {
    if (command.verifiedCapability.role !== "instructor") {
      throw new ForbiddenRoleError(
        "Only instructors can transition session phases.",
      );
    }
    BoardDealer.assertValidSeed(command.seed, "seed");
    if (command.action === "jump" && command.targetPhase === undefined) {
      throw new MalformedRequestBodyError(
        "Missing 'targetPhase': a jump must name the next phase.",
        { field: "targetPhase" },
      );
    }

    const now = this.#clock.now();
    const sessionId = SessionId.from(command.sessionId);
    const current = await this.#sessionRepo.findById(sessionId);
    if (!current) {
      throw new SessionNotFoundError(command.sessionId);
    }

    // "advance" means "advance from the phase this request first saw". The
    // target is fixed here, so a retry after a competing advance is rejected
    // as an invalid transition rather than skipping a phase.
    const targetPhase = command.action === "advance"
      ? PHASE_TRANSITIONS.get(current.currentPhase)
      : command.targetPhase;
    if (!targetPhase) {
      return {
        state: PublicSessionStateProjector.toDto(current),
      };
    }
    if (PHASE_TRANSITIONS.get(current.currentPhase) !== targetPhase) {
      throw new InvalidPhaseTransitionError(current.currentPhase, targetPhase);
    }

    // Dealt once, before the retried command: the seed (possibly a freshly
    // generated one) and so the board stay the same across retries.
    const board = await this.#dealBoardFor(current, targetPhase, command.seed);

    const session = await this.#sessionUpdates.run(sessionId, (session) => {
      session.transitionTo(targetPhase, now, board);
      return session;
    });

    return {
      state: PublicSessionStateProjector.toDto(session),
    };
  }

  /**
   * Deals the board of the round `targetPhase` enters, if any. Seed
   * precedence: the request's seed, then (Round 1 only) the seed given at
   * session creation, then a freshly generated seed.
   */
  async #dealBoardFor(
    session: GameSession,
    targetPhase: PhaseIdentifier,
    requestSeed: string | undefined,
  ): Promise<RoundBoard | undefined> {
    const roundNumber = GameSession.roundEnteredBy(targetPhase);
    if (roundNumber === null) {
      return undefined;
    }

    const pack = await this.#packs.load(session);

    const creationSeed = roundNumber === 1
      ? session.creationSeed
      : null;
    const seed = requestSeed ?? creationSeed ?? this.#seedGenerator.nextSeed();

    return BoardDealer.deal(
      {
        roundNumber,
        seed,
        rows: pack.boardConfig.rows,
        cols: pack.boardConfig.cols,
        cards: pack.cards,
      },
      this.#seededRandom.forSeed(seed),
    );
  }
}
