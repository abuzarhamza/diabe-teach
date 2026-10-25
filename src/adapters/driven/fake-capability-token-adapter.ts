import {
  CapabilityTokenPort,
  VerifiedCapability,
} from "../../application/ports/capability-token.port.js";

export class FakeCapabilityTokenAdapter implements CapabilityTokenPort {
  readonly #tokens: Map<string, VerifiedCapability>;

  public constructor(
    initialTokens: Readonly<Record<string, VerifiedCapability>> = {},
  ) {
    this.#tokens = new Map(Object.entries(initialTokens));
  }

  public registerToken(token: string, capability: VerifiedCapability): void {
    this.#tokens.set(token, capability);
  }

  public async verifyToken(token: string): Promise<VerifiedCapability | null> {
    return this.#tokens.get(token) ?? null;
  }
}
