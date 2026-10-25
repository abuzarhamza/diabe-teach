import { createHmac, timingSafeEqual } from "node:crypto";
import {
  CapabilityTokenPort,
  VerifiedCapability,
} from "../../application/ports/capability-token.port.js";

export class HmacCapabilityTokenAdapter implements CapabilityTokenPort {
  readonly #secret: string;

  public constructor(secret: string) {
    if (!secret || secret.trim().length === 0) {
      throw new Error("HmacCapabilityTokenAdapter requires a non-empty secret.");
    }
    this.#secret = secret;
  }

  public async signToken(capability: VerifiedCapability): Promise<string> {
    const payloadJson = JSON.stringify({
      role: capability.role,
      sessionId: capability.sessionId,
      ...(capability.participantId
        ? { participantId: capability.participantId }
        : {}),
    });
    const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
    const signatureB64 = createHmac("sha256", this.#secret)
      .update(payloadB64)
      .digest("base64url");
    return `${payloadB64}.${signatureB64}`;
  }

  public async verifyToken(token: string): Promise<VerifiedCapability | null> {
    const parts = token.split(".");
    if (parts.length !== 2) {
      return null;
    }
    const [payloadB64, signatureB64] = parts;
    if (!payloadB64 || !signatureB64) {
      return null;
    }

    const expectedSigB64 = createHmac("sha256", this.#secret)
      .update(payloadB64)
      .digest("base64url");

    const actualBuf = Buffer.from(signatureB64, "utf8");
    const expectedBuf = Buffer.from(expectedSigB64, "utf8");
    if (
      actualBuf.length !== expectedBuf.length ||
      !timingSafeEqual(actualBuf, expectedBuf)
    ) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      if (
        (parsed.role !== "instructor" && parsed.role !== "participant") ||
        typeof parsed.sessionId !== "string" ||
        parsed.sessionId.length === 0
      ) {
        return null;
      }
      return {
        role: parsed.role,
        sessionId: parsed.sessionId,
        ...(typeof parsed.participantId === "string"
          ? { participantId: parsed.participantId }
          : {}),
      };
    } catch {
      return null;
    }
  }
}
