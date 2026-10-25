import {
  GetCurriculumPackByIdQuery,
  GetCurriculumPackByIdResult,
} from "../../../application/ports/get-curriculum-pack-by-id.port.js";
import { GetCurriculumPackByIdUseCase } from "../../../application/use-cases/get-curriculum-pack-by-id.use-case.js";
import { PackNotFoundError } from "../../../domain/errors/domain-errors.js";
import { BaseHttpHandler } from "./endpoint-handler.factory.js";
import {
  GetPackByIdHandlerDependencies,
  HttpRequestInput,
  RouteContext,
} from "./http-handler.types.js";

export class GetPackByIdHttpHandler extends BaseHttpHandler<
  GetCurriculumPackByIdQuery,
  GetCurriculumPackByIdResult
> {
  readonly #useCase: GetCurriculumPackByIdUseCase;

  public constructor(deps: GetPackByIdHandlerDependencies) {
    super(200);
    this.#useCase = new GetCurriculumPackByIdUseCase(deps);
  }

  public transformRequest({
    request,
    context,
  }: HttpRequestInput): GetCurriculumPackByIdQuery {
    return {
      packId: this.#resolvePackIdFromContext(context),
      bearerToken: BaseHttpHandler.parseBearerTokenHeader(
        request.headers.get("authorization"),
      ),
    };
  }

  protected async execute(
    query: GetCurriculumPackByIdQuery,
  ): Promise<GetCurriculumPackByIdResult> {
    return this.#useCase.execute(query);
  }

  #resolvePackIdFromContext(context?: RouteContext): string {
    const paramPackId = context?.params?.packId;
    if (typeof paramPackId === "string" && paramPackId.length > 0) {
      return decodeURIComponent(paramPackId);
    }
    throw new PackNotFoundError("");
  }
}
