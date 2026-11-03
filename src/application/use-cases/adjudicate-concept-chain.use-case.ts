import type {
  AdjudicateConceptChainCommand,
  AdjudicateConceptChainDependencies,
  AdjudicateConceptChainResult,
  AdjudicateConceptChainUseCasePort,
  AdjudicatedChainDto,
} from "../ports/adjudicate-concept-chain.port.js";
import type { GameSessionRepositoryPort } from "../ports/game-session-repository.port.js";
import {
  AdjudicationLockedError,
  ChainNotFoundError,
  ForbiddenRoleError,
  SessionNotFoundError,
} from "../../domain/errors/domain-errors.js";
import { SessionId } from "../../domain/game-session/session-id.js";

export class AdjudicateConceptChainUseCase
implements AdjudicateConceptChainUseCasePort {
  readonly #sessionRepo: GameSessionRepositoryPort;

  public constructor(deps: AdjudicateConceptChainDependencies) {
    this.#sessionRepo = deps.sessionRepo;
  }

  public async execute(
    command: AdjudicateConceptChainCommand,
  ): Promise<AdjudicateConceptChainResult> {
    const sessionId = SessionId.from(command.sessionId);
    const session = await this.#sessionRepo.findById(sessionId);

    if (!session) {
      throw new SessionNotFoundError(command.sessionId);
    }

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
        decidedAt: new Date(),
      });
    }
    else if (action === "ai-evaluate") {
      chain.setVerdict({
        isApproved: true,
        isLocked: false,
        feedback: "AI evaluation placeholder",
        qualityScore: 75,
        decidedBy: "ai",
        decidedAt: new Date(),
      });
    }

    await this.#sessionRepo.update(session);

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
}
