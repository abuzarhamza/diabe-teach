import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  GetGameSessionStateDependencies,
  GetGameSessionStateQuery,
  GetGameSessionStateResult,
  GetGameSessionStateUseCasePort,
} from "../ports/get-game-session-state.port.js";
import { SessionNotFoundError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";

export class GetGameSessionStateUseCase
implements GetGameSessionStateUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;

  public constructor(deps: GetGameSessionStateDependencies) {
    this.#sessionRepo = deps.sessionRepo;
  }

  public async execute(
    query: GetGameSessionStateQuery,
  ): Promise<GetGameSessionStateResult> {
    const sessionId = SessionId.from(query.sessionId);
    const session = await this.#sessionRepo.findById(sessionId);

    if (!session) {
      throw new SessionNotFoundError(query.sessionId);
    }

    const state = PublicSessionStateProjector.toDto(session);

    return { state };
  }
}
