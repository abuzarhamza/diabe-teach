import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_MONGODB_DB_NAME } from "./curriculum-pack.schema.js";
import {
  EnvYamlAuthConfig,
  EnvYamlConfig,
  EnvYamlMongoConfig,
  ResolvedEnvConfig,
} from "./env-yaml-config-loader.types.js";

export class EnvYamlConfigLoader {
  public static parseYamlString(content: string): EnvYamlConfig {
    if (!content || !content.trim()) {
      return {};
    }

    const lines = content.split(/\r?\n/);
    let currentSection: "mongodb" | "auth" | null = null;
    const mongodb: Record<string, string> = {};
    const auth: Record<string, string> = {};

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      if (line === "mongodb:") {
        currentSection = "mongodb";
        continue;
      }
      if (line === "auth:") {
        currentSection = "auth";
        continue;
      }

      const match = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
      if (match && match[1] && match[2] !== undefined) {
        const key = match[1];
        let val = match[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }

        if (currentSection === "mongodb") {
          mongodb[key] = val;
        } else if (currentSection === "auth") {
          auth[key] = val;
        }
      }
    }

    const result: EnvYamlConfig = {};
    if (Object.keys(mongodb).length > 0) {
      (result as { mongodb: EnvYamlMongoConfig }).mongodb = {
        uri: mongodb.uri,
        database: mongodb.database,
      };
    }
    if (Object.keys(auth).length > 0) {
      (result as { auth: EnvYamlAuthConfig }).auth = {
        capability_token_secret: auth.capability_token_secret,
        api_key: auth.api_key,
      };
    }

    return result;
  }

  public static loadFromFile(filePath: string): EnvYamlConfig {
    try {
      const resolvedPath = resolve(process.cwd(), filePath);
      if (!existsSync(resolvedPath)) {
        return {};
      }
      const fileContent = readFileSync(resolvedPath, "utf-8");
      return EnvYamlConfigLoader.parseYamlString(fileContent);
    } catch {
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
