export type CapabilityRole = "instructor" | "participant";

export interface VerifiedCapability {
  readonly role: CapabilityRole;
  readonly sessionId: string;
  readonly participantId?: string;
}

export interface CapabilityTokenPort {
  verifyToken: (token: string) => Promise<VerifiedCapability | null>;
}
