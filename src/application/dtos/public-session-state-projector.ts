import type { GameSession } from "../../domain/game-session/game-session.js";
import type { RoundBoard } from "../../domain/game-session/round-board.types.js";
import type { PublicSessionStateDto } from "../ports/create-game-session.port.js";
import type { BoardGridViewDto } from "./board-grid-view.dto.js";

export class PublicSessionStateProjector {
  public static toDto(session: GameSession): PublicSessionStateDto {
    return {
      sessionId: session.sessionId.value,
      roomCode: session.roomCode.value,
      packId: session.packId,
      packVersion: session.packVersion,
      mode: session.mode,
      adjudicationMode: session.adjudicationMode,
      currentPhase: session.currentPhase,
      activeRoundNumber: session.activeRoundNumber,
      phaseStartedAt: session.phaseStartedAt.toISOString(),
      phaseEndsAt: session.phaseEndsAt?.toISOString() ?? null,
      participantCount: session.participantCount,
      activeBoard: PublicSessionStateProjector.#toBoardView(session.activeBoard),
    };
  }

  static #toBoardView(board: RoundBoard | null): BoardGridViewDto | null {
    if (board === null) {
      return null;
    }
    return {
      seed: board.seed,
      rows: board.rows,
      cols: board.cols,
      cells: board.cells.map((cards, row) =>
        cards.map((card, col) => ({ row, col, card })),
      ),
    };
  }
}
