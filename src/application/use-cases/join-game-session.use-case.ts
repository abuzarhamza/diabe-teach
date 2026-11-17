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
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";

export class JoinGameSessionUseCase implements JoinGameSessionUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #sessionUpdates: GameSessionUpdateRetrier;
  readonly #tokenSigner: CapabilityTokenSignerPort;

  public constructor(deps: JoinGameSessionDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo);
    this.#tokenSigner = deps.tokenSigner;
  }

  public async execute(
    command: JoinGameSessionCommand,
  ): Promise<JoinGameSessionResult> {
    const roomCode = RoomCode.from(command.roomCode);
    const found = await this.#sessionRepo.findByRoomCode(roomCode);

    if (!found) {
      throw new RoomCodeNotFoundError(command.roomCode);
    }

    const { session, participant } = await this.#sessionUpdates.run(
      found.sessionId,
      session => ({
        session,
        participant: session.addParticipant(command.displayName ?? "Anonymous"),
      }),
    );

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
