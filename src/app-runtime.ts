import type {
  ProductionDependencies,
  RuntimeEnvConfig,
  ServerlessHandlerOptions,
  ServerlessHttpHandler,
  ServerlessRequestContext,
  ServerlessRouteConfig,
} from "./app-runtime.types.js";
import { OpenApiHttpApp } from "./adapters/inbound/http/create-app.js";
import { EnvYamlConfigLoader } from "./adapters/outbound/env-yaml-config-loader.js";
import { HmacCapabilityTokenAdapter } from "./adapters/outbound/hmac-capability-token-adapter.js";
import {
  DEFAULT_MONGODB_DB_NAME,
  MongoCurriculumPackRepository,
} from "./adapters/outbound/mongo-curriculum-pack-repository.js";

export interface LoadEnvConfigOptions {
  readonly yamlFilePath?: string | false;
}

export class AppRuntime {
  static #cachedProductionDependencies: ProductionDependencies | null = null;

  public static loadEnvConfig(
    env: NodeJS.ProcessEnv = process.env,
    options?: LoadEnvConfigOptions,
  ): RuntimeEnvConfig {
    const yamlConfig
      = options?.yamlFilePath === false
        ? {}
        : EnvYamlConfigLoader.loadFromFile(
            options?.yamlFilePath ?? ".env.dev.yaml",
          );
    const resolvedYaml = EnvYamlConfigLoader.toRuntimeEnvConfig(yamlConfig);

    return {
      mongoUri: AppRuntime.#trimOrFallback(
        env.MONGODB_URI,
        resolvedYaml.mongoUri,
      ),
      mongoDbName:
        AppRuntime.#trimOrFallback(
          env.MONGODB_DB_NAME,
          resolvedYaml.mongoDbName,
        ) ?? DEFAULT_MONGODB_DB_NAME,
      capabilityTokenSecret: AppRuntime.#trimOrFallback(
        env.CAPABILITY_TOKEN_SECRET,
        resolvedYaml.capabilityTokenSecret,
      ),
      apiKey: AppRuntime.#trimOrFallback(env.API_KEY, resolvedYaml.apiKey),
    };
  }

  static #trimOrFallback(
    value: string | undefined,
    fallback?: string,
  ): string | undefined {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0
      ? trimmed
      : fallback;
  }

  public static buildProductionDependencies(
    env: NodeJS.ProcessEnv = process.env,
  ): ProductionDependencies {
    const config = AppRuntime.loadEnvConfig(env);

    return {
      packRepo: MongoCurriculumPackRepository.fromConfig(config),
      tokenVerifier: HmacCapabilityTokenAdapter.fromSecret(
        config.capabilityTokenSecret,
      ),
      apiKey: config.apiKey,
      requireApiKey: Boolean(config.apiKey),
    };
  }

  public static getProductionDependencies(): ProductionDependencies {
    if (!AppRuntime.#cachedProductionDependencies) {
      AppRuntime.#cachedProductionDependencies
        = AppRuntime.buildProductionDependencies();
    }
    return AppRuntime.#cachedProductionDependencies;
  }

  public static setProductionDependencies(
    deps: ProductionDependencies | null,
  ): void {
    AppRuntime.#cachedProductionDependencies = deps;
  }

  public static readonly DEFAULT_MAX_BODY_BYTES = 1024 * 1024; // 1 MB

  public static async validateBodySize(
    request: Request,
    maxBodyBytes: number,
  ): Promise<Response | null> {
    if (request.method === "GET" || request.method === "HEAD") {
      return null;
    }

    const contentLengthStr = request.headers.get("content-length");
    if (contentLengthStr !== null) {
      const contentLength = Number.parseInt(contentLengthStr, 10);
      if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
        return new Response(
          JSON.stringify({
            code: "INVALID_REQUEST_BODY",
            message: `Request body exceeds size limit of ${maxBodyBytes} bytes.`,
            details: {
              maxBodyBytes,
              actualBytes: contentLength,
            },
          }),
          {
            status: 413,
            headers: {
              "content-type": "application/json; charset=utf-8",
            },
          },
        );
      }
    }

    if (request.body) {
      try {
        const cloned = request.clone();
        const buffer = await cloned.arrayBuffer();
        if (buffer.byteLength > maxBodyBytes) {
          return new Response(
            JSON.stringify({
              code: "INVALID_REQUEST_BODY",
              message: `Request body exceeds size limit of ${maxBodyBytes} bytes.`,
              details: {
                maxBodyBytes,
                actualBytes: buffer.byteLength,
              },
            }),
            {
              status: 413,
              headers: {
                "content-type": "application/json; charset=utf-8",
              },
            },
          );
        }
      }
      catch {
        // Body already consumed or non-cloneable
      }
    }

    return null;
  }

  public static createServerlessHttpHandler(
    optionsOrDeps?: ProductionDependencies | ServerlessHandlerOptions,
  ): ServerlessHttpHandler {
    const deps
      = optionsOrDeps && "packRepo" in optionsOrDeps
        ? optionsOrDeps
        : optionsOrDeps?.dependencies;
    const maxBodyBytes
      = optionsOrDeps && "maxBodyBytes" in optionsOrDeps
        ? optionsOrDeps.maxBodyBytes
        : AppRuntime.DEFAULT_MAX_BODY_BYTES;

    const fixedApp = deps
      ? new OpenApiHttpApp(deps)
      : null;

    return async (
      request: Request,
      context?: ServerlessRequestContext,
    ): Promise<Response> => {
      const sizeError = await AppRuntime.validateBodySize(
        request,
        maxBodyBytes ?? AppRuntime.DEFAULT_MAX_BODY_BYTES,
      );
      if (sizeError) {
        return sizeError;
      }

      const app
        = fixedApp ?? new OpenApiHttpApp(AppRuntime.getProductionDependencies());
      return app.fetch(request, {
        params: context?.params,
      });
    };
  }

  public static defineServerlessRouteConfig(
    route: ServerlessRouteConfig,
  ): ServerlessRouteConfig {
    return {
      path: route.path,
      method: route.method,
    };
  }
}
