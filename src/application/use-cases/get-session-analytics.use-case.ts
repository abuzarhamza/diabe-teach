import type { GameSession } from "../../domain/game-session/game-session.js";
import type { CohortAnalyticsReport } from "../dtos/session-analytics.dto.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  GetSessionAnalyticsDependencies,
  GetSessionAnalyticsQuery,
  GetSessionAnalyticsResult,
  GetSessionAnalyticsUseCasePort,
} from "../ports/get-session-analytics.port.js";
import { ForbiddenRoleError, SessionNotFoundError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { LearnerAnalyticsService } from "../services/learner-analytics-service.js";
import { SessionPackLoader } from "../services/session-pack-loader.js";

/**
 * Serves a Game Session's analytics: a learner gets their own metacognitive
 * report plus the cohort summary; the instructor gets the cohort summary.
 */
export class GetSessionAnalyticsUseCase implements GetSessionAnalyticsUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  /** Reads the session's pinned Pack Version (or the latest, for legacy sessions). */
  readonly #packs: SessionPackLoader;
  readonly #analytics = new LearnerAnalyticsService();

  public constructor(deps: GetSessionAnalyticsDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#packs = new SessionPackLoader(deps.packRepo);
  }

  public async execute(
    query: GetSessionAnalyticsQuery,
  ): Promise<GetSessionAnalyticsResult> {
    const session = await this.#sessionRepo.findById(SessionId.from(query.sessionId));
    if (!session) {
      throw new SessionNotFoundError(query.sessionId);
    }

    const cohortSummary = this.#cohortSummary(session);
    const capability = query.verifiedCapability;

    if (capability.role === "instructor") {
      return { role: "instructor", cohortSummary };
    }

    if (!capability.participantId) {
      throw new ForbiddenRoleError("Participant ID is required.");
    }

    const pack = await this.#packs.load(session);
    return {
      role: "participant",
      participantReport: this.#analytics.buildReport(session, pack, capability.participantId),
      cohortSummary,
    };
  }

  /** Until api-completion ticket 06: the session id and participant count only. */
  #cohortSummary(session: GameSession): CohortAnalyticsReport {
    return {
      sessionId: session.sessionId.value,
      participantCount: session.participantCount,
    };
  }
}
