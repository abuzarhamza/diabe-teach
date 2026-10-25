import type { Config, Context } from "@netlify/functions";
import { CapabilityTokenPort } from "../../src/application/ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "../../src/application/ports/curriculum-pack-repository.port.js";
import { EndpointHttpHandler } from "../../src/adapters/driving/http/http-handler.types.js";

export type NetlifyHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface NetlifyRuntimeEnvConfig {
  readonly mongoUri?: string;
  readonly mongoDbName: string;
  readonly capabilityTokenSecret?: string;
}

export interface NetlifyProductionDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

export interface NetlifyEndpointRouteConfig {
  readonly path: `/${string}`;
  readonly method: NetlifyHttpMethod | NetlifyHttpMethod[];
}

export type NetlifyFunctionHandler = (
  request: Request,
  context: Context,
) => Promise<Response>;

export type DrivingHandlerFactory<
  TDeps = NetlifyProductionDependencies,
> = (deps: TDeps) => EndpointHttpHandler;

export type { Config as NetlifyFunctionConfig, Context as NetlifyFunctionContext };
