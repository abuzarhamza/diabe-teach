import { CapabilityTokenPort } from "./application/ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "./application/ports/curriculum-pack-repository.port.js";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RuntimeEnvConfig {
  readonly mongoUri?: string;
  readonly mongoDbName: string;
  readonly capabilityTokenSecret?: string;
  readonly apiKey?: string;
}

export interface ProductionDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export interface ServerlessRouteConfig {
  readonly path: `/${string}`;
  readonly method: HttpMethod | HttpMethod[];
}

export interface ServerlessRequestContext {
  readonly params?: Record<string, string | undefined>;
}

export type ServerlessHttpHandler = (
  request: Request,
  context?: ServerlessRequestContext,
) => Promise<Response>;
