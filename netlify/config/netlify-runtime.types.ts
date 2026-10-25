import type { Config, Context } from "@netlify/functions";
import { CapabilityTokenPort } from "../../src/application/ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "../../src/application/ports/curriculum-pack-repository.port.js";

export type NetlifyHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface NetlifyRuntimeEnvConfig {
  readonly mongoUri?: string;
  readonly mongoDbName: string;
  readonly capabilityTokenSecret?: string;
  readonly apiKey?: string;
}

export interface NetlifyProductionDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export interface NetlifyEndpointRouteConfig {
  readonly path: `/${string}`;
  readonly method: NetlifyHttpMethod | NetlifyHttpMethod[];
}

export type NetlifyFunctionHandler = (
  request: Request,
  context: Context,
) => Promise<Response>;

export type { Config as NetlifyFunctionConfig, Context as NetlifyFunctionContext };
