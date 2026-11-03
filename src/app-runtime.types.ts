import type { CapabilityTokenPort, CapabilityTokenSignerPort } from "./application/ports/capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "./application/ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "./application/ports/game-session-repository.port.js";

export interface RuntimeEnvConfig {
  readonly mongoUri?: string;
  readonly mongoDbName: string;
  readonly capabilityTokenSecret?: string;
  readonly apiKey?: string;
}

export interface ProductionDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly sessionRepo?: GameSessionRepositoryPort;
  readonly tokenSigner?: CapabilityTokenSignerPort;
  readonly tokenVerifier?: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}
