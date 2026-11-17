import type { CapabilityTokenSignerPort } from "../ports/capability-token.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  JoinGameSessionCommand,
  JoinGameSessionDependencies,
  JoinGameSessionResult,
  JoinGameSessionUseCasePort,
} from "../ports/join-game-session.port.js";
import { RoomCodeNotFoundError } from "../../domain/errors/domain-errors.js";
import { RoomCode } from "../../domain/game-session/room-code.js";
import { PublicSessionStateProjector } from "../dtos/public-session-state-projector.js";

export class JoinGameSessionUseCase implements JoinGameSessionUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #tokenSigner: CapabilityTokenSignerPort;

  public constructor(deps: JoinGameSessionDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#tokenSigner = deps.tokenSigner;
  }

  public async execute(
    command: JoinGameSessionCommand,
  ): Promise<JoinGameSessionResult> {
    const roomCode = RoomCode.from(command.roomCode);
    const session = await this.#sessionRepo.findByRoomCode(roomCode);

    if (!session) {
      throw new RoomCodeNotFoundError(command.roomCode);
    }

    const participant = session.addParticipant(
      command.displayName ?? "Anonymous",
    );

    await this.#sessionRepo.update(session);

    const participantToken = await this.#tokenSigner.signToken({
      role: "participant",
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
    });

    const state = PublicSessionStateProjector.toDto(session);

    return {
      sessionId: session.sessionId.value,
      participantId: participant.participantId,
      participantToken,
      state,
    };
  }
}
