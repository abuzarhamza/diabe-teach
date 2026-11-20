import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  buildRequestSchemasModule,
  GENERATED_MODULE_PATH,
  OPENAPI_PATH,
} from "../scripts/generate-request-schemas.js";
import { requestBodySchemas } from "../src/adapters/inbound/http/request-schemas.generated.js";

const openapiYaml = readFileSync(OPENAPI_PATH, "utf8");
const STALE_HINT = "request-schemas.generated.ts is stale: run `npm run generate:request-schemas` and commit the result.";

/** operationIds of every operation in the contract that declares a request body. */
function operationIdsWithRequestBody(): string[] {
  const document = parseYaml(openapiYaml) as {
    paths: Record<string, Record<string, { operationId?: string; requestBody?: unknown }>>;
  };
  return Object.values(document.paths)
    .flatMap(pathItem => Object.values(pathItem))
    .filter(operation => operation?.requestBody !== undefined)
    .map(operation => operation.operationId ?? "<missing operationId>");
}

describe("request body schemas generated from docs/api/openapi.yaml", () => {
  it("the committed module matches a fresh generation", async () => {
    const fresh = await buildRequestSchemasModule(openapiYaml);
    expect(readFileSync(GENERATED_MODULE_PATH, "utf8"), STALE_HINT).toBe(fresh);
  });

  it("a contract change without regenerating is detected as stale", async () => {
    const changed = openapiYaml.replace(
      "    JoinSessionRequest:\n      type: object\n      required: [roomCode]",
      "    JoinSessionRequest:\n      type: object\n      required: [roomCode, displayName]",
    );
    expect(changed).not.toBe(openapiYaml);
    const fresh = await buildRequestSchemasModule(changed);
    expect(readFileSync(GENERATED_MODULE_PATH, "utf8")).not.toBe(fresh);
  });

  it("has a schema for every operation with a request body, and no others", () => {
    expect(Object.keys(requestBodySchemas).sort()).toEqual(operationIdsWithRequestBody().sort());
  });

  it("resolves every $ref", () => {
    expect(JSON.stringify(requestBodySchemas)).not.toContain("\"$ref\"");
  });

  it("every schema compiles under Ajv's JSON Schema 2020-12 strict mode", () => {
    const ajv = new Ajv2020({
      strict: true,
      discriminator: true,
      allErrors: true,
      validateFormats: false,
    });
    for (const [operationId, entry] of Object.entries(requestBodySchemas)) {
      expect(() => ajv.compile(entry.schema as object), operationId).not.toThrow();
    }
  });

  it("documents stepRationales as plain strings, as submit-chain stores them", () => {
    const ajv = new Ajv2020({ strict: true, discriminator: true, validateFormats: false });
    const validate = ajv.compile(requestBodySchemas.submitConceptChain.schema as object);
    const path = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ];
    expect(validate({
      path,
      narrativeExplanation: "A story",
      stepRationales: ["Insulin moves glucose"],
    })).toBe(true);
    expect(validate({
      path,
      narrativeExplanation: "A story",
      stepRationales: [
        { fromCoord: path[0], toCoord: path[1], rationale: "Insulin moves glucose" },
      ],
    })).toBe(false);
  });

  it("refuses the OpenAPI 3.0 `nullable` keyword", async () => {
    const withNullable = openapiYaml.replace(
      "      required: [roomCode]\n      properties:\n        roomCode:\n          type: string",
      "      required: [roomCode]\n      properties:\n        roomCode:\n          type: string\n          nullable: true",
    );
    expect(withNullable).not.toBe(openapiYaml);
    await expect(buildRequestSchemasModule(withNullable)).rejects.toThrow(/nullable/);
  });
});
