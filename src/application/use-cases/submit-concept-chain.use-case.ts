import type { GridCoord } from "../../domain/game-session/concept-chain.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  SubmitConceptChainCommand,
  SubmitConceptChainDependencies,
  SubmitConceptChainResult,
  SubmitConceptChainUseCasePort,
  SubmittedChainDto,
} from "../ports/submit-concept-chain.port.js";
import {
  ChainTopologyInvalidError,
  ForbiddenRoleError,
  SessionNotFoundError,
} from "../../domain/errors/domain-errors.js";
import { ConceptChain } from "../../domain/game-session/concept-chain.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";
import { SessionPackLoader } from "../services/session-pack-loader.js";

export class SubmitConceptChainUseCase
implements SubmitConceptChainUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  /** Reads the session's pinned Pack Version (or the latest, for legacy sessions). */
  readonly #packs: SessionPackLoader;
  readonly #clock: ClockPort;

  public constructor(deps: SubmitConceptChainDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#packs = new SessionPackLoader(deps.packRepo);
    this.#clock = deps.clock;
  }

  public async execute(
    command: SubmitConceptChainCommand,
  ): Promise<SubmitConceptChainResult> {
    // Read the time on arrival so storage latency does not eat the grace period.
    const receivedAt = this.#clock.now();

    if (command.verifiedCapability.role !== "participant") {
      throw new ForbiddenRoleError("Only participants can submit chains.");
    }

    const participantId = command.verifiedCapability.participantId;
    if (!participantId) {
      throw new ForbiddenRoleError("Participant ID is required.");
    }

    // The minimum chain length comes from the session's Curriculum Pack. The
    // update below runs synchronously, so the pack is loaded first (its first
    // attempt reuses this session); a session's pack and version never
    // change, so a retry needs no pack reload.
    const sessionId = SessionId.from(command.sessionId);
    const loaded = await this.#sessionRepo.findById(sessionId);
    if (!loaded) {
      throw new SessionNotFoundError(command.sessionId);
    }
    const minChainLength = (await this.#packs.load(loaded)).minChainLength;

    // Built once, so a retry keeps the same chain id and submission time.
    let built: ConceptChain | undefined;
    const chain = await this.#sessionUpdates.run(
      sessionId,
      (session) => {
        this.#validateChainTopology(command.path, minChainLength);

        built ??= ConceptChain.create({
          participantId,
          roundNumber: command.roundNumber,
          path: command.path,
          keywordIds: command.keywordIds,
          narrativeExplanation: command.narrativeExplanation,
          stepRationales: command.stepRationales,
        });

        return session.addChain(built, receivedAt);
      },
      loaded,
    );

    const chainDto: SubmittedChainDto = {
      chainId: chain.chainId,
      participantId: chain.participantId,
      roundNumber: chain.roundNumber,
      path: chain.path,
      keywordIds: chain.keywordIds,
      narrativeExplanation: chain.narrativeExplanation,
      chainLength: chain.chainLength,
      status: chain.status,
      submittedAt: chain.submittedAt.toISOString(),
    };

    return { chain: chainDto };
  }

  #validateChainTopology(path: readonly GridCoord[], minChainLength: number): void {
    if (path.length < minChainLength) {
      throw new ChainTopologyInvalidError(
        `Chain must have at least ${minChainLength} cells`,
      );
    }

    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1]!;
      const curr = path[i]!;

      const rowDiff = Math.abs(curr.row - prev.row);
      const colDiff = Math.abs(curr.col - prev.col);

      if (rowDiff > 1 || colDiff > 1 || (rowDiff === 0 && colDiff === 0)) {
        throw new ChainTopologyInvalidError(
          `Cells at positions ${i - 1} and ${i} are not adjacent`,
        );
      }
    }

    const seen = new Set<string>();
    for (const coord of path) {
      const key = `${coord.row},${coord.col}`;
      if (seen.has(key)) {
        throw new ChainTopologyInvalidError("Chain contains duplicate cells");
      }
      seen.add(key);
    }
  }
}
