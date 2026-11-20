import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import type { GameSession } from "../../domain/game-session/game-session.js";
import type {
  CohortAnalyticsReport,
  LearnerMetacognitiveReport,
} from "../dtos/session-analytics.dto.js";
import { LearnerAnalyticsService } from "./learner-analytics-service.js";

/**
 * Computes the cohort summary of a stored Game Session. The cohort is the
 * learners still in the session (the same learners `participantCount`
 * counts). Each mean is taken over the learners who have the input; with no
 * such learner it is `null`.
 */
export class CohortAnalyticsService {
  readonly #learners = new LearnerAnalyticsService();

  public buildSummary(session: GameSession, pack: CurriculumPack): CohortAnalyticsReport {
    const learnerIds = session.participants
      .filter(p => p.leftAt === null)
      .map(p => p.participantId);
    const reports = learnerIds.map(id => this.#learners.buildReport(session, pack, id));
    const pretests = reports.map(r => r.pretest).filter(s => s !== null);
    const posttests = reports.map(r => r.posttest).filter(s => s !== null);

    return {
      sessionId: session.sessionId.value,
      participantCount: learnerIds.length,
      pretestCohortMeanPercentage: mean(pretests.map(s => s.correctPercentage)),
      posttestCohortMeanPercentage: mean(posttests.map(s => s.correctPercentage)),
      posttestWrongGuessMeanPercentage: mean(posttests.map(s => s.wrongGuessPercentage)),
      posttestIDontKnowMeanPercentage: mean(posttests.map(s => s.iDontKnowPercentage)),
      meanChainDiversityIndex: mean(reports.map(chainDiversity)) ?? 0,
      boardNeglectHeatmap: this.#boardNeglectHeatmap(session, learnerIds),
    };
  }

  /**
   * `heatmap[row][col]` = how many cohort learners never used that grid
   * coordinate in a chain of any round with a stored board. The grid spans
   * the largest stored board; empty when no board was dealt.
   */
  #boardNeglectHeatmap(session: GameSession, learnerIds: readonly string[]): number[][] {
    const boards = session.roundBoards;
    if (boards.length === 0) {
      return [];
    }
    const rows = Math.max(...boards.map(b => b.rows));
    const cols = Math.max(...boards.map(b => b.cols));
    const boardRounds = new Set(boards.map(b => b.roundNumber));

    const usedBy = learnerIds.map(id => new Set(
      session.chains
        .filter(c => c.participantId === id && boardRounds.has(c.roundNumber))
        .flatMap(c => c.path.map(({ row, col }) => `${row},${col}`)),
    ));

    return Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) =>
        usedBy.filter(used => !used.has(`${row},${col}`)).length));
  }
}

function chainDiversity(report: LearnerMetacognitiveReport): number {
  return report.chainDiversityIndex;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, v) => sum + v, 0) / values.length;
}
