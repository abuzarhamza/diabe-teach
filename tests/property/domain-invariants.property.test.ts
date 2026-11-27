import type { AssessmentQuestion, KeywordCard } from "../../src/domain/curriculum-pack/curriculum-pack.types.js";
import type { GridCoord } from "../../src/domain/game-session/concept-chain.js";
import type { McqAnswerChoice } from "../../src/domain/game-session/game-session.types.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MongoCredentialStripper } from "../../src/adapters/outbound/mongo-credential-stripper.js";
import { SeedrandomSeededRandom } from "../../src/adapters/outbound/seedrandom-seeded-random.js";
import { CohortAnalyticsService } from "../../src/application/services/cohort-analytics-service.js";
import { LearnerAnalyticsService } from "../../src/application/services/learner-analytics-service.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";
import { ChainAlreadySubmittedError } from "../../src/domain/errors/domain-errors.js";
import { BoardDealer } from "../../src/domain/game-session/board-dealer.js";
import { ChainTopology } from "../../src/domain/game-session/chain-topology.js";
import { ConceptChain } from "../../src/domain/game-session/concept-chain.js";
import { GameSession } from "../../src/domain/game-session/game-session.js";

function buildCards(count: number): KeywordCard[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `card-${idx}`,
    verbatimLabel: `Card ${idx}`,
    displayLabel: `Card ${idx}`,
    aliases: [],
    domainId: `domain-${idx % 4}`,
    summary: `Summary for card ${idx}`,
  }));
}

/**
 * Generates a guaranteed self-avoiding Chebyshev-8 walk on a rows x cols board
 * by walking along a boustrophedon (snake) Hamiltonian path.
 */
function buildSnakePath(rows: number, cols: number, startIdx: number, length: number): GridCoord[] {
  const snake: GridCoord[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const col = r % 2 === 0
        ? c
        : cols - 1 - c;
      snake.push({ row: r, col });
    }
  }
  const maxStart = Math.max(0, snake.length - length);
  const safeStart = Math.min(startIdx, maxStart);
  return snake.slice(safeStart, safeStart + length);
}

describe("property-Based Tests: Domain & Analytics Mathematical Invariants", () => {
  const seededRandom = new SeedrandomSeededRandom();

  it("boardDealer.deal satisfies dimensions, card uniqueness, and seed determinism across arbitrary seeds and sizes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
        fc.integer({ min: 3, max: 7 }),
        fc.integer({ min: 0, max: 15 }),
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.constantFrom(1 as const, 2 as const),
        (rows, cols, extraCards, seed, roundNumber) => {
          const totalNeeded = rows * cols;
          const deck = buildCards(totalNeeded + extraCards);

          const boardA = BoardDealer.deal(
            {
              roundNumber,
              seed,
              rows,
              cols,
              cards: deck,
            },
            seededRandom.forSeed(seed),
          );
          const boardB = BoardDealer.deal(
            {
              roundNumber,
              seed,
              rows,
              cols,
              cards: deck,
            },
            seededRandom.forSeed(seed),
          );

          // 1. Dimensions match rows x cols
          expect(boardA.rows).toBe(rows);
          expect(boardA.cols).toBe(cols);
          expect(boardA.cells.length).toBe(rows);
          for (const row of boardA.cells) {
            expect(row.length).toBe(cols);
          }

          // 2. Every cell is a distinct KeywordCard from the deck (no duplicate card IDs)
          const flatIds = boardA.cells.flatMap(r => r.map(c => c.id));
          expect(flatIds.length).toBe(totalNeeded);
          expect(new Set(flatIds).size).toBe(totalNeeded);

          // 3. Same seed + deck + dimensions produces the exact same board grid
          expect(boardA).toEqual(boardB);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("chebyshev-8 ConceptChain paths satisfy reversal symmetry and GameSession duplicate-chain rejection (forward & reverse)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 7 }),
        fc.integer({ min: 3, max: 7 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 4, max: 9 }),
        fc.string({ minLength: 1, maxLength: 32 }),
        (rows, cols, startIdx, rawLength, seed) => {
          const length = Math.min(rawLength, rows * cols);
          const path = buildSnakePath(rows, cols, startIdx, length);

          // Verify Chebyshev-8 adjacency holds in both forward and reverse directions
          const reversedPath = [...path].reverse();
          for (const candidate of [path, reversedPath]) {
            expect(() => ChainTopology.assertValid(candidate, length)).not.toThrow();
          }

          // Verify GameSession accepts the chain once and rejects both identical and reversed paths
          // from the same participant in the same round with ChainAlreadySubmittedError
          const now = new Date("2026-04-01T10:00:00.000Z");
          const session = GameSession.create({
            packId: "diabe-teach",
            mode: "classroom",
            adjudicationMode: "peer-instructor",
            phaseStartedAt: now,
          });
          const learnerA = session.addParticipant("Learner A");
          const learnerB = session.addParticipant("Learner B");

          const deck = buildCards(rows * cols + 5);
          const board = BoardDealer.deal(
            {
              roundNumber: 1,
              seed,
              rows,
              cols,
              cards: deck,
            },
            seededRandom.forSeed(seed),
          );

          session.transitionTo("trial-orientation", now);
          session.transitionTo("round-1:chain-mapping", now, board);

          const chainA = ConceptChain.create({
            participantId: learnerA.participantId,
            roundNumber: 1,
            path,
            keywordIds: [],
            narrativeExplanation: "Original forward chain",
          });
          const recorded = session.addChain(chainA, now);
          expect(recorded.chainLength).toBe(path.length);
          expect(recorded.keywordIds.length).toBe(path.length);

          // Exact forward duplicate from same participant is rejected
          const duplicateForward = ConceptChain.create({
            participantId: learnerA.participantId,
            roundNumber: 1,
            path,
            keywordIds: [],
            narrativeExplanation: "Different narrative, same forward path",
          });
          expect(() => session.addChain(duplicateForward, now)).toThrow(ChainAlreadySubmittedError);

          // Exact reverse duplicate from same participant is also rejected
          const duplicateReverse = ConceptChain.create({
            participantId: learnerA.participantId,
            roundNumber: 1,
            path: reversedPath,
            keywordIds: [],
            narrativeExplanation: "Different narrative, reversed path",
          });
          expect(() => session.addChain(duplicateReverse, now)).toThrow(ChainAlreadySubmittedError);

          // A different participant CAN submit the exact same path
          const otherParticipantChain = ConceptChain.create({
            participantId: learnerB.participantId,
            roundNumber: 1,
            path,
            keywordIds: [],
            narrativeExplanation: "Classmate submitting the same path",
          });
          expect(session.addChain(otherParticipantChain, now).participantId).toBe(learnerB.participantId);
        },
      ),
      { numRuns: 75 },
    );
  });

  it("learnerAnalyticsService.summarizeStage percentages always lie in [0, 100], sum to 100, and calibration ratio lies in [0, 1]", () => {
    const answerChoiceArb: fc.Arbitrary<McqAnswerChoice> = fc.constantFrom<McqAnswerChoice>(
      0,
      1,
      2,
      3,
      "I_DONT_KNOW",
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.array(
          fc.record({
            correctIndex: fc.constantFrom(0 as const, 1 as const, 2 as const, 3 as const),
            choice: answerChoiceArb,
          }),
          { minLength: 1, maxLength: 25 },
        ),
        (_seed, items) => {
          const questions: AssessmentQuestion[] = items.map((item, idx) => ({
            id: `q-${idx}`,
            bloomLevel: 2,
            stem: `Question ${idx}?`,
            options: ["A", "B", "C", "D"],
            correctIndex: item.correctIndex,
            relatedKeywordIds: ["card-0"],
            explanation: "Explanation",
          }));

          const answers = new Map<string, McqAnswerChoice>(
            items.map((item, idx) => [`q-${idx}`, item.choice]),
          );

          const summary = LearnerAnalyticsService.summarizeStage("pretest", questions, answers);

          expect(summary.totalQuestions).toBe(items.length);
          expect(summary.correctCount + summary.wrongGuessCount + summary.iDontKnowCount).toBe(items.length);

          expect(summary.correctPercentage).toBeGreaterThanOrEqual(0);
          expect(summary.correctPercentage).toBeLessThanOrEqual(100);
          expect(summary.wrongGuessPercentage).toBeGreaterThanOrEqual(0);
          expect(summary.wrongGuessPercentage).toBeLessThanOrEqual(100);
          expect(summary.iDontKnowPercentage).toBeGreaterThanOrEqual(0);
          expect(summary.iDontKnowPercentage).toBeLessThanOrEqual(100);

          const percentageSum
            = summary.correctPercentage
              + summary.wrongGuessPercentage
              + summary.iDontKnowPercentage;
          expect(percentageSum).toBeCloseTo(100, 7);

          expect(summary.uncertaintyCalibrationRatio).toBeGreaterThanOrEqual(0);
          expect(summary.uncertaintyCalibrationRatio).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 120 },
    );
  });

  it("cohortAnalyticsService chainDiversityIndex lies in [0, 1] and boardNeglectHeatmap cells lie in [0, activeParticipantCount]", () => {
    const cohortAnalytics = new CohortAnalyticsService();

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 3 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
        (totalLearners, leavingCount, approvalFlags) => {
          const now = new Date("2026-04-01T10:00:00.000Z");
          const session = GameSession.create({
            packId: DIABE_TEACH_PACK.id.value,
            mode: "classroom",
            adjudicationMode: "peer-instructor",
            phaseStartedAt: now,
          });

          const learners = Array.from({ length: totalLearners }, (_, idx) =>
            session.addParticipant(`Learner ${idx}`));

          const board = BoardDealer.deal(
            {
              roundNumber: 1,
              seed: "cohort-prop-seed",
              rows: DIABE_TEACH_PACK.boardConfig.rows,
              cols: DIABE_TEACH_PACK.boardConfig.cols,
              cards: DIABE_TEACH_PACK.cards,
            },
            seededRandom.forSeed("cohort-prop-seed"),
          );

          session.transitionTo("trial-orientation", now);
          session.transitionTo("round-1:chain-mapping", now, board);

          learners.forEach((learner, idx) => {
            const path = buildSnakePath(
              board.rows,
              board.cols,
              idx % 10,
              DIABE_TEACH_PACK.minChainLength,
            );
            const chain = session.addChain(
              ConceptChain.create({
                participantId: learner.participantId,
                roundNumber: 1,
                path,
                keywordIds: [],
                narrativeExplanation: `Chain by ${learner.displayName}`,
              }),
              now,
            );
            if (approvalFlags[idx % approvalFlags.length]) {
              chain.setVerdict({
                isApproved: true,
                isLocked: true,
                decidedBy: "instructor",
                decidedAt: now,
                feedback: "Approved",
                qualityScore: 8,
              });
            }
          });

          const actualLeavers = Math.min(leavingCount, totalLearners);
          for (let i = 0; i < actualLeavers; i++) {
            session.leave(learners[i]!.participantId, now);
          }

          const activeLearnersCount = totalLearners - actualLeavers;
          const summary = cohortAnalytics.buildSummary(session, DIABE_TEACH_PACK);

          expect(summary.participantCount).toBe(activeLearnersCount);
          expect(summary.meanChainDiversityIndex).toBeGreaterThanOrEqual(0);
          expect(summary.meanChainDiversityIndex).toBeLessThanOrEqual(1);

          expect(summary.boardNeglectHeatmap.length).toBe(board.rows);
          for (const row of summary.boardNeglectHeatmap) {
            expect(row.length).toBe(board.cols);
            for (const cellCount of row) {
              expect(Number.isInteger(cellCount)).toBe(true);
              expect(cellCount).toBeGreaterThanOrEqual(0);
              expect(cellCount).toBeLessThanOrEqual(activeLearnersCount);
            }
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  it("mongoCredentialStripper.strip removes arbitrary user:pass@ credentials from mongodb:// and mongodb+srv:// URIs", () => {
    const safeTokenArb = fc.stringMatching(/^[\w.%-]{1,24}$/);

    fc.assert(
      fc.property(
        fc.constantFrom("mongodb://", "mongodb+srv://"),
        safeTokenArb,
        safeTokenArb,
        safeTokenArb,
        fc.string({ maxLength: 40 }),
        (scheme, user, pass, hostLabel, prefix) => {
          const host = `${hostLabel}.example.mongodb.net/diabe_teach`;
          const rawText = `${prefix} MongoNetworkError: connect ECONNREFUSED ${scheme}${user}:${pass}@${host}`;
          const stripped = MongoCredentialStripper.strip(rawText);

          expect(stripped).not.toContain(`${user}:${pass}@`);
          expect(stripped).toContain(`${scheme}${host}`);
        },
      ),
      { numRuns: 150 },
    );
  });
});
