import type { GridCoord } from "../../domain/game-session/concept-chain.js";
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

export class SubmitConceptChainUseCase
implements SubmitConceptChainUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #minChainLength: number;

  public constructor(deps: SubmitConceptChainDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#minChainLength = deps.minChainLength ?? 4;
  }

  public async execute(
    command: SubmitConceptChainCommand,
  ): Promise<SubmitConceptChainResult> {
    if (command.verifiedCapability.role !== "participant") {
      throw new ForbiddenRoleError("Only participants can submit chains.");
    }

    const participantId = command.verifiedCapability.participantId;
    if (!participantId) {
      throw new ForbiddenRoleError("Participant ID is required.");
    }

    const sessionId = SessionId.from(command.sessionId);
    const session = await this.#sessionRepo.findById(sessionId);

    if (!session) {
      throw new SessionNotFoundError(command.sessionId);
    }

    this.#validateChainTopology(command.path);

    const chain = ConceptChain.create({
      participantId,
      roundNumber: command.roundNumber,
      path: command.path,
      keywordIds: command.keywordIds,
      narrativeExplanation: command.narrativeExplanation,
      stepRationales: command.stepRationales,
    });

    session.addChain(chain);
    await this.#sessionRepo.update(session);

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

  #validateChainTopology(path: readonly GridCoord[]): void {
    if (path.length < this.#minChainLength) {
      throw new ChainTopologyInvalidError(
        `Chain must have at least ${this.#minChainLength} cells`,
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
