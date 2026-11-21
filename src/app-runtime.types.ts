import type { AccountTokenSignerPort, AccountTokenVerifierPort } from "./application/ports/account-token.port.js";
import type { BoardSeedGeneratorPort, SeededRandomPort } from "./application/ports/board-randomness.port.js";
import type { CapabilityTokenPort, CapabilityTokenSignerPort } from "./application/ports/capability-token.port.js";
import type { ClockPort } from "./application/ports/clock.port.js";
import type { CurriculumPackRepositoryPort } from "./application/ports/curriculum-pack-repository.port.js";
import type { GameSessionRepositoryPort } from "./application/ports/game-session-repository.port.js";
import type { IdGeneratorPort } from "./application/ports/id-generator.port.js";
import type { InstructorAccountRepositoryPort } from "./application/ports/instructor-account-repository.port.js";
import type { LoggerPort, LogLevel } from "./application/ports/logger.port.js";
import type { PasswordHasherPort } from "./application/ports/password-hasher.port.js";

export interface RuntimeEnvConfig {
  readonly mongoUri?: string;
  readonly mongoDbName: string;
  readonly capabilityTokenSecret?: string;
  /** Signs Account Tokens; kept apart so rotating one secret never invalidates the other token kind. */
  readonly accountTokenSecret?: string;
  readonly apiKey?: string;
  /** From LOG_LEVEL / `logging.level`; `info` by default, `debug` under netlify dev. */
  readonly logLevel: LogLevel;
  /** A LOG_LEVEL / `logging.level` value that isn't a level; `logLevel` is then `info`. */
  readonly invalidLogLevel?: string;
  /** From LOG_PRETTY / `logging.pretty`; only ever true under netlify dev. */
  readonly logPretty: boolean;
}

export interface ProductionDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly sessionRepo?: GameSessionRepositoryPort;
  readonly tokenSigner?: CapabilityTokenSignerPort;
  readonly tokenVerifier?: CapabilityTokenPort;
  readonly clock?: ClockPort;
  readonly seededRandom?: SeededRandomPort;
  readonly seedGenerator?: BoardSeedGeneratorPort;
  readonly accountRepo: InstructorAccountRepositoryPort;
  readonly passwordHasher?: PasswordHasherPort;
  readonly accountTokenSigner?: AccountTokenSignerPort;
  readonly accountTokenVerifier?: AccountTokenVerifierPort;
  readonly idGenerator?: IdGeneratorPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
  readonly logger?: LoggerPort;
}
