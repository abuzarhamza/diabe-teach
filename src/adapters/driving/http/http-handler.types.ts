import { CapabilityTokenPort } from "../../../application/ports/capability-token.port.js";
import { CurriculumPackRepositoryPort } from "../../../application/ports/curriculum-pack-repository.port.js";

export interface RouteContext {
  readonly params?: Readonly<Record<string, string | undefined>>;
}

export interface HttpRequestInput {
  readonly request: Request;
  readonly context?: RouteContext;
}

export type EndpointHttpHandler = (
  request: Request,
  context?: RouteContext,
) => Promise<Response>;

export interface HttpEndpointDefinition<TQuery, TResult> {
  readonly transformRequest: (
    input: HttpRequestInput,
  ) => TQuery | Promise<TQuery>;
  readonly execute: (query: TQuery) => Promise<TResult>;
  readonly successStatus?: number;
}

export interface GetPackByIdHandlerDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

export interface AppDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly tokenVerifier?: CapabilityTokenPort;
}

export interface HttpApp {
  fetch(request: Request, context?: RouteContext): Promise<Response>;
}
