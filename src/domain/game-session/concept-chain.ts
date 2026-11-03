import { randomUUID } from "node:crypto";

export type ChainStatus = "pending-review" | "approved" | "rejected";

export interface GridCoord {
  readonly row: number;
  readonly col: number;
}

export interface PeerVote {
  readonly voterParticipantId: string;
  readonly decision: "approve" | "challenge";
  readonly comment?: string;
  readonly votedAt: Date;
}

export interface ChainVerdict {
  readonly isApproved: boolean;
  readonly isLocked: boolean;
  readonly feedback?: string;
  readonly qualityScore?: number;
  readonly decidedBy: "peer-consensus" | "ai" | "instructor";
  readonly decidedAt: Date;
}

export interface ConceptChainProps {
  readonly chainId?: string;
  readonly participantId: string;
  readonly roundNumber: 1 | 2;
  readonly path: readonly GridCoord[];
  readonly keywordIds: readonly string[];
  readonly narrativeExplanation: string;
  readonly stepRationales?: readonly string[];
  readonly status?: ChainStatus;
  readonly peerVotes?: readonly PeerVote[];
  readonly verdict?: ChainVerdict | null;
  readonly submittedAt?: Date;
}

export class ConceptChain {
  readonly #chainId: string;
  readonly #participantId: string;
  readonly #roundNumber: 1 | 2;
  readonly #path: readonly GridCoord[];
  readonly #keywordIds: readonly string[];
  readonly #narrativeExplanation: string;
  readonly #stepRationales: readonly string[];
  readonly #submittedAt: Date;
  readonly #peerVotes: PeerVote[];

  #status: ChainStatus;
  #verdict: ChainVerdict | null;

  private constructor(props: ConceptChainProps) {
    this.#chainId = props.chainId ?? randomUUID();
    this.#participantId = props.participantId;
    this.#roundNumber = props.roundNumber;
    this.#path = props.path;
    this.#keywordIds = props.keywordIds;
    this.#narrativeExplanation = props.narrativeExplanation;
    this.#stepRationales = props.stepRationales ?? [];
    this.#status = props.status ?? "pending-review";
    this.#peerVotes = props.peerVotes
      ? [...props.peerVotes]
      : [];
    this.#verdict = props.verdict ?? null;
    this.#submittedAt = props.submittedAt ?? new Date();
  }

  public static create(props: ConceptChainProps): ConceptChain {
    return new ConceptChain(props);
  }

  public get chainId(): string {
    return this.#chainId;
  }

  public get participantId(): string {
    return this.#participantId;
  }

  public get roundNumber(): 1 | 2 {
    return this.#roundNumber;
  }

  public get path(): readonly GridCoord[] {
    return this.#path;
  }

  public get keywordIds(): readonly string[] {
    return this.#keywordIds;
  }

  public get narrativeExplanation(): string {
    return this.#narrativeExplanation;
  }

  public get stepRationales(): readonly string[] {
    return this.#stepRationales;
  }

  public get status(): ChainStatus {
    return this.#status;
  }

  public get peerVotes(): readonly PeerVote[] {
    return this.#peerVotes;
  }

  public get verdict(): ChainVerdict | null {
    return this.#verdict;
  }

  public get submittedAt(): Date {
    return this.#submittedAt;
  }

  public get chainLength(): number {
    return this.#path.length;
  }

  public addPeerVote(vote: Omit<PeerVote, "votedAt">): void {
    if (this.#verdict?.isLocked) {
      return;
    }
    this.#peerVotes.push({
      ...vote,
      votedAt: new Date(),
    });
  }

  public setVerdict(verdict: ChainVerdict): void {
    if (this.#verdict?.isLocked) {
      return;
    }
    this.#verdict = verdict;
    this.#status = verdict.isApproved ? "approved" : "rejected";
  }
}
