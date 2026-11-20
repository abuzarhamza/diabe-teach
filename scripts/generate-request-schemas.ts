#!/usr/bin/env node
/**
 * Generates `src/adapters/inbound/http/request-schemas.generated.ts` from
 * `docs/api/openapi.yaml`: one JSON Schema per operation request body, keyed
 * by operationId, with every `$ref` resolved by
 * `@apidevtools/json-schema-ref-parser` (ADR-0005: no hand-written resolver),
 * plus the list of every operationId, so each route can declare its own to
 * `createApiHandler` and get its body validated.
 *
 * The output targets Ajv's JSON Schema 2020-12 build (`ajv/dist/2020`), the
 * dialect OpenAPI 3.1 schemas use, with `discriminator: true`:
 * - `discriminator.mapping` is dropped (Ajv rejects it; every `oneOf` branch
 *   already pins the tag with `enum`/`const`);
 * - OpenAPI-only annotations (`example`, `xml`, `externalDocs`) are dropped;
 * - the OpenAPI 3.0 keyword `nullable` is refused: write `type: [T, "null"]`.
 *
 * `openapi.yaml` is still not read at runtime; only this build step reads it.
 * `tests/request-schemas-generated.test.ts` fails when the committed module is stale.
 *
 * Usage:
 *   npm run generate:request-schemas
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { parse } from "yaml";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const OPENAPI_PATH = path.join(REPO_ROOT, "docs/api/openapi.yaml");
export const GENERATED_MODULE_PATH = path.join(REPO_ROOT, "src/adapters/inbound/http/request-schemas.generated.ts");

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;
const OPENAPI_ONLY_KEYWORDS = new Set(["example", "xml", "externalDocs"]);

interface OpenApiOperation {
  operationId?: string;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: unknown }>;
  };
}

interface OpenApiDocument {
  openapi?: string;
  paths?: Record<string, Partial<Record<(typeof HTTP_METHODS)[number], OpenApiOperation>>>;
}

/** Rewrites an OpenAPI 3.1 schema node into plain JSON Schema 2020-12 that Ajv accepts. */
function toAjvSchema(node: unknown, pointer: string): unknown {
  if (Array.isArray(node))
    return node.map((item, index) => toAjvSchema(item, `${pointer}/${index}`));
  if (node === null || typeof node !== "object")
    return node;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "nullable")
      throw new Error(`${pointer}: "nullable" is OpenAPI 3.0; use type: [T, "null"] in OpenAPI 3.1.`);
    if (OPENAPI_ONLY_KEYWORDS.has(key))
      continue;
    if (key === "discriminator" && value !== null && typeof value === "object") {
      const { mapping: _mapping, ...discriminator } = value as Record<string, unknown>;
      result[key] = discriminator;
      continue;
    }
    result[key] = toAjvSchema(value, `${pointer}/${key}`);
  }
  return result;
}

/** Builds the generated module's source text from the contents of an OpenAPI 3.1 document. */
export async function buildRequestSchemasModule(openapiYaml: string): Promise<string> {
  const document = parse(openapiYaml) as OpenApiDocument;
  if (!document.openapi?.startsWith("3.1."))
    throw new Error(`Expected an OpenAPI 3.1 document, got "${document.openapi}".`);

  // `circular: false` fails fast: a circular schema could not be emitted as a literal.
  const resolved = await $RefParser.dereference(document, {
    dereference: { circular: false },
  }) as OpenApiDocument;

  const schemas: Record<string, { required: boolean; schema: unknown }> = {};
  const operationIds: string[] = [];
  for (const [route, pathItem] of Object.entries(resolved.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation)
        continue;
      const where = `${method.toUpperCase()} ${route}`;
      if (operation.operationId) {
        if (operationIds.includes(operation.operationId))
          throw new Error(`Duplicate operationId "${operation.operationId}".`);
        operationIds.push(operation.operationId);
      }
      if (!operation.requestBody)
        continue;
      if (!operation.operationId)
        throw new Error(`${where} has a request body but no operationId.`);
      const schema = operation.requestBody.content?.["application/json"]?.schema;
      if (!schema)
        throw new Error(`${where} (${operation.operationId}) has no application/json request schema.`);
      schemas[operation.operationId] = {
        required: operation.requestBody.required === true,
        schema: toAjvSchema(schema, `${operation.operationId}/requestBody`),
      };
    }
  }

  return [
    "// GENERATED FILE: do not edit by hand.",
    "// Source: docs/api/openapi.yaml (request bodies, $refs resolved), keyed by operationId.",
    "// Regenerate with `npm run generate:request-schemas`; tests/request-schemas-generated.test.ts fails when stale.",
    "// Dialect: JSON Schema 2020-12 for Ajv (`ajv/dist/2020`, option `discriminator: true`).",
    "",
    `export const requestBodySchemas = ${JSON.stringify(schemas, null, 2)} as const;`,
    "",
    "export type RequestBodyOperationId = keyof typeof requestBodySchemas;",
    "",
    "/** Every operationId in the contract, with or without a request body. */",
    `export const apiOperationIds = ${JSON.stringify(operationIds, null, 2)} as const;`,
    "",
    "export type ApiOperationId = (typeof apiOperationIds)[number];",
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  const source = await buildRequestSchemasModule(await readFile(OPENAPI_PATH, "utf8"));
  await writeFile(GENERATED_MODULE_PATH, source, "utf8");
  console.log(`Wrote ${path.relative(REPO_ROOT, GENERATED_MODULE_PATH)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
