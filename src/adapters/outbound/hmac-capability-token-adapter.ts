import type {
  CapabilityTokenPort,
  CapabilityTokenSignerPort,
  VerifiedCapability,
} from "../../application/ports/capability-token.port.js";
import { jwtVerify, SignJWT } from "jose";
import { CAPABILITY_TOKEN_KIND } from "./token-kinds.js";

export class HmacCapabilityTokenAdapter implements CapabilityTokenPort, CapabilityTokenSignerPort {
  readonly #secretKey: Uint8Array;

  public constructor(secret: string) {
    if (!secret || secret.trim().length === 0) {
      throw new Error("HmacCapabilityTokenAdapter requires a non-empty secret.");
    }
    this.#secretKey = new TextEncoder().encode(secret);
  }

  public static fromSecret(
    secret: string | undefined,
  ): HmacCapabilityTokenAdapter | undefined {
    const trimmed = secret?.trim();
    return trimmed
      ? new HmacCapabilityTokenAdapter(trimmed)
      : undefined;
  }

  public async signToken(capability: VerifiedCapability): Promise<string> {
    return new SignJWT({
      kind: CAPABILITY_TOKEN_KIND,
      role: capability.role,
      sessionId: capability.sessionId,
      ...(capability.participantId
        ? { participantId: capability.participantId }
        : {}),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(this.#secretKey);
  }

  public async verifyToken(token: string): Promise<VerifiedCapability | null> {
    try {
      const { payload } = await jwtVerify(token, this.#secretKey, {
        algorithms: ["HS256"],
      });

      // Tokens issued before the `kind` claim have none and stay valid; any
      // other kind (such as an Account Token) is refused.
      if (
        (payload.kind !== undefined && payload.kind !== CAPABILITY_TOKEN_KIND)
        || (payload.role !== "instructor" && payload.role !== "participant")
        || typeof payload.sessionId !== "string"
        || payload.sessionId.length === 0
      ) {
        return null;
      }

      return {
        role: payload.role,
        sessionId: payload.sessionId,
        ...(typeof payload.participantId === "string"
          && payload.participantId.length > 0
          ? { participantId: payload.participantId }
          : {}),
      };
    }
    catch {
      return null;
    }
  }
}
