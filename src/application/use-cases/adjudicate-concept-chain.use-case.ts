import type { ConceptChain } from "../../domain/game-session/concept-chain.js";
import type { GameSession } from "../../domain/game-session/game-session.js";
import type {
  AdjudicateConceptChainCommand,
  AdjudicateConceptChainDependencies,
  AdjudicateConceptChainResult,
  AdjudicateConceptChainUseCasePort,
  AdjudicatedChainDto,
} from "../ports/adjudicate-concept-chain.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import {
  AdjudicationLockedError,
  ChainNotFoundError,
  ForbiddenRoleError,
} from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";
import { GameSessionUpdateRetrier } from "../services/game-session-update-retrier.js";
import { SilentLogger } from "../services/silent-logger.js";

export class AdjudicateConceptChainUseCase
implements AdjudicateConceptChainUseCasePort {
  readonly #sessionUpdates: GameSessionUpdateRetrier;

  public constructor(deps: AdjudicateConceptChainDependencies) {
    this.#sessionUpdates = new GameSessionUpdateRetrier(deps.sessionRepo, deps.writeConflictBackoff);
  }

  public async execute(
    command: AdjudicateConceptChainCommand,
    logger: LoggerPort = new SilentLogger(),
  ): Promise<AdjudicateConceptChainResult> {
    const decidedAt = new Date();

    const chain = await this.#sessionUpdates.run(
      SessionId.from(command.sessionId),
      session => this.#adjudicate(session, command, decidedAt),
      { logger },
    );
    this.#logDecision(logger, command, chain);

    const chainDto: AdjudicatedChainDto = {
      chainId: chain.chainId,
      participantId: chain.participantId,
      roundNumber: chain.roundNumber,
      path: chain.path,
      keywordIds: chain.keywordIds,
      narrativeExplanation: chain.narrativeExplanation,
      chainLength: chain.chainLength,
      status: chain.status,
      peerVotes: chain.peerVotes,
      verdict: chain.verdict,
      submittedAt: chain.submittedAt.toISOString(),
    };

    return { chain: chainDto };
  }

  /** One `info` line per peer vote or instructor ruling (the AI placeholder is not logged). */
  #logDecision(logger: LoggerPort, command: AdjudicateConceptChainCommand, chain: ConceptChain): void {
    const ids = { sessionId: command.sessionId, chainId: chain.chainId };
    switch (command.action) {
      case "peer-approve":
      case "peer-challenge":
        logger.info(
          {
            ...ids,
            decision: command.action === "peer-approve"
              ? "approve"
              : "challenge",
          },
          "chain peer vote",
        );
        break;
      case "instructor-approve":
      case "instructor-reject":
        logger.info({ ...ids, approved: command.action === "instructor-approve" }, "chain instructor ruling");
        break;
      default:
        break;
    }
  }

  #adjudicate(
    session: GameSession,
    command: AdjudicateConceptChainCommand,
    decidedAt: Date,
  ): ConceptChain {
    const chain = session.getChain(command.chainId);
    if (!chain) {
      throw new ChainNotFoundError(command.chainId);
    }

    if (chain.verdict?.isLocked) {
      throw new AdjudicationLockedError(command.chainId);
    }

    const { action, verifiedCapability } = command;

    if (action === "peer-approve" || action === "peer-challenge") {
      if (verifiedCapability.role !== "participant") {
        throw new ForbiddenRoleError("Only participants can cast peer votes.");
      }
      const participantId = verifiedCapability.participantId;
      if (!participantId) {
        throw new ForbiddenRoleError("Participant ID is required.");
      }
      session.assertParticipantHasNotLeft(participantId);
      chain.addPeerVote({
        voterParticipantId: participantId,
        decision: action === "peer-approve"
          ? "approve"
          : "challenge",
        comment: command.comment,
      });
    }
    else if (
      action === "instructor-approve"
      || action === "instructor-reject"
    ) {
      if (verifiedCapability.role !== "instructor") {
        throw new ForbiddenRoleError(
          "Only instructors can issue final rulings.",
        );
      }
      chain.setVerdict({
        isApproved: action === "instructor-approve",
        isLocked: true,
        feedback: command.feedback,
        qualityScore: command.qualityScore,
        decidedBy: "instructor",
        decidedAt,
      });
    }
    else if (action === "ai-evaluate") {
      chain.setVerdict({
        isApproved: true,
        isLocked: false,
        feedback: "AI evaluation placeholder",
        qualityScore: 75,
        decidedBy: "ai",
        decidedAt,
      });
    }

    return chain;
  }
}
