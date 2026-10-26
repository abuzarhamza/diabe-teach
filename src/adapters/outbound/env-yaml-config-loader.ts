import type {
  EnvYamlAuthConfig,
  EnvYamlConfig,
  EnvYamlMongoConfig,
  ResolvedEnvConfig,
} from "./env-yaml-config-loader.types.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { DEFAULT_MONGODB_DB_NAME } from "./curriculum-pack.schema.js";

export class EnvYamlConfigLoader {
  public static parseYamlString(content: string): EnvYamlConfig {
    if (!content || !content.trim()) {
      return {};
    }

    try {
      const parsed = parseYaml(content) as Record<string, unknown> | null;
      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      const result: EnvYamlConfig = {};

      if (parsed.mongodb && typeof parsed.mongodb === "object") {
        const mongo = parsed.mongodb as Record<string, unknown>;
        (result as { mongodb: EnvYamlMongoConfig }).mongodb = {
          uri: typeof mongo.uri === "string"
            ? mongo.uri
            : undefined,
          database: typeof mongo.database === "string"
            ? mongo.database
            : undefined,
        };
      }

      if (parsed.auth && typeof parsed.auth === "object") {
        const auth = parsed.auth as Record<string, unknown>;
        (result as { auth: EnvYamlAuthConfig }).auth = {
          capability_token_secret:
            typeof auth.capability_token_secret === "string"
              ? auth.capability_token_secret
              : undefined,
          api_key: typeof auth.api_key === "string"
            ? auth.api_key
            : undefined,
        };
      }

      return result;
    }
    catch {
      return {};
    }
  }

  public static loadFromFile(filePath: string): EnvYamlConfig {
    try {
      const resolvedPath = resolve(process.cwd(), filePath);
      if (!existsSync(resolvedPath)) {
        return {};
      }
      const fileContent = readFileSync(resolvedPath, "utf-8");
      return EnvYamlConfigLoader.parseYamlString(fileContent);
    }
    catch {
      return {};
    }
  }

  public static toRuntimeEnvConfig(config: EnvYamlConfig): ResolvedEnvConfig {
    return {
      mongoUri: config.mongodb?.uri,
      mongoDbName: config.mongodb?.database ?? DEFAULT_MONGODB_DB_NAME,
      capabilityTokenSecret: config.auth?.capability_token_secret,
      apiKey: config.auth?.api_key,
    };
  }
}
