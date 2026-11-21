import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import type {
  GetSessionAnalyticsDependencies,
  GetSessionAnalyticsQuery,
  GetSessionAnalyticsResult,
  GetSessionAnalyticsUseCasePort,
} from "../ports/get-session-analytics.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import { ForbiddenRoleError, SessionNotFoundError } from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { CohortAnalyticsService } from "../services/cohort-analytics-service.js";
import { LearnerAnalyticsService } from "../services/learner-analytics-service.js";
import { SessionPackLoader } from "../services/session-pack-loader.js";
import { SilentLogger } from "../services/silent-logger.js";

/**
 * Serves a Game Session's analytics: a learner gets their own metacognitive
 * report plus the cohort summary; the instructor gets the cohort summary.
 */
export class GetSessionAnalyticsUseCase implements GetSessionAnalyticsUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;
  /** Reads the session's pinned Pack Version (or the latest, for legacy sessions). */
  readonly #packs: SessionPackLoader;
  readonly #analytics = new LearnerAnalyticsService();
  readonly #cohort = new CohortAnalyticsService();

  public constructor(deps: GetSessionAnalyticsDependencies) {
    this.#sessionRepo = deps.sessionRepo;
    this.#packs = new SessionPackLoader(deps.packRepo);
  }

  public async execute(
    query: GetSessionAnalyticsQuery,
    logger: LoggerPort = new SilentLogger(),
  ): Promise<GetSessionAnalyticsResult> {
    const session = await this.#sessionRepo.findById(SessionId.from(query.sessionId));
    if (!session) {
      throw new SessionNotFoundError(query.sessionId);
    }

    const pack = await this.#packs.load(session, logger);
    const cohortSummary = this.#cohort.buildSummary(session, pack);
    const capability = query.verifiedCapability;

    if (capability.role === "instructor") {
      return { role: "instructor", cohortSummary };
    }

    if (!capability.participantId) {
      throw new ForbiddenRoleError("Participant ID is required.");
    }

    return {
      role: "participant",
      participantReport: this.#analytics.buildReport(session, pack, capability.participantId),
      cohortSummary,
    };
  }
}
