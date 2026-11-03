import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  GetRoundStandingsDependencies,
  GetRoundStandingsQuery,
  GetRoundStandingsResult,
  GetRoundStandingsUseCasePort,
  PlayerRoundStandingDto,
} from "../ports/get-round-standings.port.js";
import { SessionNotFoundError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";

export class GetRoundStandingsUseCase implements GetRoundStandingsUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;

  public constructor(deps: GetRoundStandingsDependencies) {
    this.#sessionRepo = deps.sessionRepo;
  }

  public async execute(
    query: GetRoundStandingsQuery,
  ): Promise<GetRoundStandingsResult> {
    const sessionId = SessionId.from(query.sessionId);
    const session = await this.#sessionRepo.findById(sessionId);

    if (!session) {
      throw new SessionNotFoundError(query.sessionId);
    }

    const roundChains = session.getChainsForRound(query.roundNumber);
    const approvedChains = roundChains.filter(
      c => c.status === "approved" || c.verdict?.isApproved,
    );

    const participantStats = new Map<
      string,
      {
        displayName: string;
        longestChainLength: number;
        totalValidChains: number;
        chainIds: string[];
      }
    >();

    for (const chain of approvedChains) {
      const participant = session.getParticipant(chain.participantId);
      const displayName = participant?.displayName ?? "Unknown";

      const existing = participantStats.get(chain.participantId);
      if (existing) {
        existing.longestChainLength = Math.max(
          existing.longestChainLength,
          chain.chainLength,
        );
        existing.totalValidChains += 1;
        existing.chainIds.push(chain.chainId);
      }
      else {
        participantStats.set(chain.participantId, {
          displayName,
          longestChainLength: chain.chainLength,
          totalValidChains: 1,
          chainIds: [chain.chainId],
        });
      }
    }

    const sortedParticipants = [
      ...participantStats.entries(),
    ].sort(
      (a, b) => {
        const lengthDiff = b[1].longestChainLength - a[1].longestChainLength;
        if (lengthDiff !== 0)
          return lengthDiff;
        return b[1].totalValidChains - a[1].totalValidChains;
      },
    );

    const standings: PlayerRoundStandingDto[] = sortedParticipants.map(
      ([participantId, stats], index) => ({
        rank: index + 1,
        participantId,
        displayName: stats.displayName,
        longestValidChainLength: stats.longestChainLength,
        totalValidChainsCount: stats.totalValidChains,
        approvedChainIds: stats.chainIds,
      }),
    );

    const currentPhase = session.currentPhase;
    const isFinalized
      = currentPhase === `round-${query.roundNumber}:round-summary`
        || currentPhase === "posttest"
        || currentPhase === "feedback-survey"
        || currentPhase === "completed"
        || (query.roundNumber === 1 && currentPhase.startsWith("round-2"));

    return {
      roundNumber: query.roundNumber,
      isFinalized,
      standings,
    };
  }
}
