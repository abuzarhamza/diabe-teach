import type {
  CapabilityTokenPort,
  CapabilityTokenSignerPort,
  VerifiedCapability,
} from "../../application/ports/capability-token.port.js";

export class FakeCapabilityTokenAdapter
implements CapabilityTokenPort, CapabilityTokenSignerPort {
  readonly #tokens: Map<string, VerifiedCapability>;
  #tokenCounter = 0;

  public constructor(
    initialTokens: Readonly<Record<string, VerifiedCapability>> = {},
  ) {
    this.#tokens = new Map(Object.entries(initialTokens));
  }

  public registerToken(token: string, capability: VerifiedCapability): void {
    this.#tokens.set(token, capability);
  }

  public async signToken(capability: VerifiedCapability): Promise<string> {
    const token = `fake-token-${++this.#tokenCounter}`;
    this.#tokens.set(token, capability);
    return token;
  }

  public async verifyToken(token: string): Promise<VerifiedCapability | null> {
    return this.#tokens.get(token) ?? null;
  }
}
