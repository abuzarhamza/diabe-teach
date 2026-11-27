import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  ListedChainDto,
  ListRoundChainsDependencies,
  ListRoundChainsQuery,
  ListRoundChainsResult,
  ListRoundChainsUseCasePort,
} from "../ports/list-round-chains.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import { SessionNotFoundError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { SilentLogger } from "../services/silent-logger.js";

/** Shown for a participant who can't be found, as standings does. */
const UNKNOWN_DISPLAY_NAME = "Unknown";

/**
 * Lists the Concept Chains of one Gameplay Round that the caller may see,
 * in submission order. A round with no chains (or not started) is an empty
 * list, not an error.
 */
export class ListRoundChainsUseCase implements ListRoundChainsUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;

  public constructor(deps: ListRoundChainsDependencies) {
    this.#sessionRepo = deps.sessionRepo;
  }

  public async execute(
    query: ListRoundChainsQuery,
    logger: LoggerPort = new SilentLogger(),
  ): Promise<ListRoundChainsResult> {
    const session = await this.#sessionRepo.findById(SessionId.from(query.sessionId));
    if (!session) {
      throw new SessionNotFoundError(query.sessionId);
    }

    const { role, participantId } = query.verifiedCapability;
    const visible = session.getChainsForRoundVisibleTo(query.roundNumber, {
      role,
      ...(participantId !== undefined
        ? { participantId }
        : {}),
    });

    logger.debug(
      {
        sessionId: query.sessionId,
        roundNumber: query.roundNumber,
        viewer: role,
        count: visible.length,
      },
      "chain visibility applied",
    );

    const displayNameOf = (participantId: string): string =>
      session.getParticipant(participantId)?.displayName ?? UNKNOWN_DISPLAY_NAME;

    const chains: ListedChainDto[] = visible.map(chain => ({
      chainId: chain.chainId,
      sessionId: session.sessionId.value,
      participantId: chain.participantId,
      participantDisplayName: displayNameOf(chain.participantId),
      roundNumber: chain.roundNumber,
      path: chain.path,
      keywordIds: chain.keywordIds,
      narrativeExplanation: chain.narrativeExplanation,
      stepRationales: chain.stepRationales,
      chainLength: chain.chainLength,
      status: chain.status,
      peerVotes: chain.peerVotes.map(vote => ({
        ...vote,
        voterDisplayName: displayNameOf(vote.voterParticipantId),
      })),
      verdict: chain.verdict,
      submittedAt: chain.submittedAt.toISOString(),
    }));

    return { roundNumber: query.roundNumber, chains };
  }
}
