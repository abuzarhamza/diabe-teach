import type {
  CapabilityTokenPort,
  VerifiedCapability,
} from "../../../application/ports/capability-token.port.js";
import type { CurriculumPackRepositoryPort } from "../../../application/ports/curriculum-pack-repository.port.js";

export interface RouteContext {
  readonly params?: Readonly<Record<string, string | undefined>>;
  readonly verifiedCapability?: VerifiedCapability;
}

export interface HttpRequestInput {
  readonly request: Request;
  readonly context?: RouteContext;
}

export type EndpointHttpHandler = (
  request: Request,
  context?: RouteContext,
) => Promise<Response>;

export interface ApiKeyValidationConfig {
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export interface GetPackByIdHandlerDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

export interface AppDependencies extends ApiKeyValidationConfig {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

export interface HttpApp {
  fetch: (request: Request, context?: RouteContext) => Promise<Response>;
}
