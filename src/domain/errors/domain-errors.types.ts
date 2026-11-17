/** Why a Chain-Mapping phase that otherwise accepts chains turned one away. */
export type PhaseClosedReason
  = | {
    /** The phase's deadline (plus the grace period) has passed. */
    readonly phaseEndsAt: Date;
    readonly gracePeriodSec: number;
  }
  | {
    /** The chain was sent to a round that is not the active one. */
    readonly requestedRoundNumber: number;
    readonly activeRoundNumber: 1 | 2 | null;
  };
