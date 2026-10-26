import { createHmac, timingSafeEqual } from "node:crypto";
import {
  CapabilityTokenPort,
  VerifiedCapability,
} from "../../application/ports/capability-token.port.js";

export class HmacCapabilityTokenAdapter implements CapabilityTokenPort {
  static readonly #JWT_HEADER_B64 = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
    "utf8",
  ).toString("base64url");

  readonly #secret: string;

  public constructor(secret: string) {
    if (!secret || secret.trim().length === 0) {
      throw new Error("HmacCapabilityTokenAdapter requires a non-empty secret.");
    }
    this.#secret = secret;
  }

  public static fromSecret(
    secret: string | undefined,
  ): HmacCapabilityTokenAdapter | undefined {
    const trimmed = secret?.trim();
    if (!trimmed) {
      return undefined;
    }
    return new HmacCapabilityTokenAdapter(trimmed);
  }

  public async signToken(capability: VerifiedCapability): Promise<string> {
    const headerB64 = HmacCapabilityTokenAdapter.#JWT_HEADER_B64;
    const payloadJson = JSON.stringify({
      role: capability.role,
      sessionId: capability.sessionId,
      ...(capability.participantId
        ? { participantId: capability.participantId }
        : {}),
    });
    const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
    const signingInput = `${headerB64}.${payloadB64}`;
    const signatureB64 = createHmac("sha256", this.#secret)
      .update(signingInput)
      .digest("base64url");
    return `${signingInput}.${signatureB64}`;
  }

  public async verifyToken(token: string): Promise<VerifiedCapability | null> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }

    if (!HmacCapabilityTokenAdapter.#isValidHeader(headerB64)) {
      return null;
    }

    const signingInput = `${headerB64}.${payloadB64}`;
    if (
      !HmacCapabilityTokenAdapter.#isValidSignature(
        signingInput,
        signatureB64,
        this.#secret,
      )
    ) {
      return null;
    }

    return HmacCapabilityTokenAdapter.#parsePayload(payloadB64);
  }

  static #isValidHeader(headerB64: string): boolean {
    try {
      const header = JSON.parse(
        Buffer.from(headerB64, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      return header.alg === "HS256";
    } catch {
      return false;
    }
  }

  static #isValidSignature(
    signingInput: string,
    signatureB64: string,
    secret: string,
  ): boolean {
    const expectedSigB64 = createHmac("sha256", secret)
      .update(signingInput)
      .digest("base64url");
    const actualBuf = Buffer.from(signatureB64, "utf8");
    const expectedBuf = Buffer.from(expectedSigB64, "utf8");
    return (
      actualBuf.length === expectedBuf.length &&
      timingSafeEqual(actualBuf, expectedBuf)
    );
  }

  static #parsePayload(payloadB64: string): VerifiedCapability | null {
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
