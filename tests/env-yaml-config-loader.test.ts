import { describe, expect, it } from "vitest";
import { EnvYamlConfigLoader } from "../src/adapters/outbound/env-yaml-config-loader.js";

describe("EnvYamlConfigLoader (Ticket 01)", () => {
  it("parses valid YAML content into structured EnvYamlConfig", () => {
    const yamlString = `
mongodb:
  uri: "mongodb+srv://user:pass@cluster0.mongodb.net/?retryWrites=true&w=majority"
  database: "concept_chain_dev"

auth:
  capability_token_secret: "secret-123"
  api_key: "api-key-xyz"
`;

    const config = EnvYamlConfigLoader.parseYamlString(yamlString);

    expect(config).toEqual({
      mongodb: {
        uri: "mongodb+srv://user:pass@cluster0.mongodb.net/?retryWrites=true&w=majority",
        database: "concept_chain_dev",
      },
      auth: {
        capability_token_secret: "secret-123",
        api_key: "api-key-xyz",
      },
    });
  });

  it("returns empty config when content is empty or contains only comments", () => {
    const emptyYaml = "# Only comments\n# Another comment\n";
    const config = EnvYamlConfigLoader.parseYamlString(emptyYaml);
    expect(config).toEqual({});
  });

  it("loads config from a YAML file if it exists, or returns empty config if file is missing", () => {
    const nonExistentFile = "non-existent-file-xyz.yaml";
    const config = EnvYamlConfigLoader.loadFromFile(nonExistentFile);
    expect(config).toEqual({});
  });

  it("converts parsed EnvYamlConfig into RuntimeEnvConfig format", () => {
    const yamlConfig = {
      mongodb: {
        uri: "mongodb+srv://user:pass@cluster0.mongodb.net/",
        database: "concept_chain_dev",
      },
      auth: {
        capability_token_secret: "secret-123",
        api_key: "api-key-xyz",
      },
    };

    const runtimeEnv = EnvYamlConfigLoader.toRuntimeEnvConfig(yamlConfig);

    expect(runtimeEnv).toEqual({
      mongoUri: "mongodb+srv://user:pass@cluster0.mongodb.net/",
      mongoDbName: "concept_chain_dev",
      capabilityTokenSecret: "secret-123",
      apiKey: "api-key-xyz",
    });
  });
});
