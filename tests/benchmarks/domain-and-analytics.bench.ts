import type { GridCoord } from "../../src/domain/game-session/concept-chain.js";
import type { McqAnswerChoice } from "../../src/domain/game-session/game-session.types.js";
import type { RoundBoard } from "../../src/domain/game-session/round-board.types.js";
import { bench, describe } from "vitest";
import { SeedrandomSeededRandom } from "../../src/adapters/outbound/seedrandom-seeded-random.js";
import { CohortAnalyticsService } from "../../src/application/services/cohort-analytics-service.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { BoardDealer } from "../../src/domain/game-session/board-dealer.js";
import { ChainTopology } from "../../src/domain/game-session/chain-topology.js";
import { ConceptChain } from "../../src/domain/game-session/concept-chain.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

/**
 * CPU micro-benchmarks for the hot domain and analytics paths. Run with
 * `npm run bench`; `vitest run` never picks these up (it only includes
 * `*.test.ts`).
 */

const SEED = "bench-seed-7x7";
const NOW = new Date("2026-04-01T10:00:00.000Z");
const ROWS = DIABE_TEACH_PACK.boardConfig.rows;
const COLS = DIABE_TEACH_PACK.boardConfig.cols;
const MIN_CHAIN_LENGTH = DIABE_TEACH_PACK.boardConfig.minChainLength;
const seededRandom = new SeedrandomSeededRandom();

function dealBoard(roundNumber: 1 | 2 = 1): RoundBoard {
  return BoardDealer.deal(
    {
      roundNumber,
      seed: SEED,
      rows: ROWS,
      cols: COLS,
      cards: DIABE_TEACH_PACK.cards,
    },
    seededRandom.forSeed(SEED),
  );
}

/** Boustrophedon (snake) walk over the board: every step is Chebyshev-8 adjacent. */
const SNAKE: readonly GridCoord[] = Array.from({ length: ROWS * COLS }, (_, idx) => {
  const row = Math.floor(idx / COLS);
  const offset = idx % COLS;
  return {
    row,
    col: row % 2 === 0
      ? offset
      : COLS - 1 - offset,
  };
});

/** `count` distinct self-avoiding Chebyshev-8 paths of `length` cells. */
function snakePaths(count: number, length: number): GridCoord[][] {
  return Array.from({ length: count }, (_, idx) => {
    const start = idx % (SNAKE.length - length + 1);
    return SNAKE.slice(start, start + length).map(cell => ({ ...cell }));
  });
}

function sessionInChainMapping(learnerCount: number): { session: GameSession; learnerIds: string[] } {
  const session = GameSession.create({
    packId: DIABE_TEACH_PACK.id.value,
    mode: "classroom",
    adjudicationMode: "peer-instructor",
    phaseStartedAt: NOW,
  });
  const learnerIds = Array.from({ length: learnerCount }, (_, idx) =>
    session.addParticipant(`Learner ${idx}`).participantId);
  session.transitionTo("trial-orientation", NOW);
  session.transitionTo("round-1:chain-mapping", NOW, dealBoard(1));
  return { session, learnerIds };
}

const CHAIN_PATHS = snakePaths(20, 6);

describe("boardDealer.deal", () => {
  bench("deal a 7×7 (49-card) DIABE_TEACH_PACK board with a fixed seed", () => {
    dealBoard(1);
  });
});

describe("gameSession + ConceptChain", () => {
  bench("validate and record 20 Chebyshev-8 Concept Chains on a 7×7 board", () => {
    const { session, learnerIds } = sessionInChainMapping(5);
    CHAIN_PATHS.forEach((path, idx) => {
      ChainTopology.assertValid(path, MIN_CHAIN_LENGTH);
      session.addChain(
        ConceptChain.create({
          participantId: learnerIds[idx % learnerIds.length]!,
          roundNumber: 1,
          path,
          keywordIds: [],
          narrativeExplanation: `Chain ${idx}`,
        }),
        NOW,
      );
    });
  });
});

describe("cohortAnalyticsService.buildSummary", () => {
  const LEARNERS = 30;
  const questions = DIABE_TEACH_PACK.assessmentInstrument?.questions ?? [];
  const choices: readonly McqAnswerChoice[] = [0, 1, 2, 3, "I_DONT_KNOW"];
  const answersFor = (learner: number, shift: number): Map<string, McqAnswerChoice> =>
    new Map(questions.map((q, qi) => [q.id, choices[(learner + qi + shift) % choices.length]!]));

  const { session, learnerIds } = sessionInChainMapping(LEARNERS);
  const paths = snakePaths(LEARNERS * 2, 8);
  learnerIds.forEach((participantId, idx) => {
    session.submitAssessment(participantId, "pretest", answersFor(idx, 0));
    for (const path of [paths[idx * 2]!, paths[idx * 2 + 1]!]) {
      session.addChain(
        ConceptChain.create({
          participantId,
          roundNumber: 1,
          path,
          keywordIds: [],
          narrativeExplanation: "bench",
        }),
        NOW,
      );
    }
    session.submitAssessment(participantId, "posttest", answersFor(idx, 1));
  });
  const analytics = new CohortAnalyticsService();

  bench("30-learner Board Neglect Heatmap, pre/posttest means and Chain Diversity Index", () => {
    analytics.buildSummary(session, DIABE_TEACH_PACK);
  });
});
