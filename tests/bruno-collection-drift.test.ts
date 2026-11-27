import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import bruLang from "@usebruno/lang";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { requestBodySchemas } from "../src/adapters/inbound/http/request-schemas.generated.js";

const REPO_ROOT = join(import.meta.dirname, "..");
const BRUNO_DIR = join(REPO_ROOT, "docs/api/bruno");
const HTML_DOCS_PATH = join(REPO_ROOT, "docs/api/api-docs.html");
const OPENAPI_PATH = join(REPO_ROOT, "docs/api/openapi.yaml");

const {
  bruToJsonV2,
  bruToEnvJsonV2,
  collectionBruToJson,
} = bruLang as {
  bruToJsonV2: (content: string) => {
    meta?: { name?: string; type?: string; seq?: string | number };
    http?: { method?: string; url?: string; body?: string; auth?: string };
    body?: { json?: string };
    docs?: string;
    script?: { res?: string };
  };
  bruToEnvJsonV2: (content: string) => {
    variables: Array<{ name: string; value?: string; secret?: boolean }>;
  };
  collectionBruToJson: (content: string) => {
    docs?: string;
    headers?: Array<{ name: string; value: string }>;
  };
};

/**
 * Normalizes URL path parameter placeholders (`/api/v1/packs/:packId`,
 * `/api/v1/packs/{packId}`, `{{baseUrl}}/api/v1/packs/{{customPackId}}`)
 * to `/:param` so Netlify Functions, OpenAPI, and Bruno `.bru` URLs compare 1-to-1.
 */
function normalizeRoute(method: string, rawPath: string): string {
  const withoutBase = rawPath.replace(/^\{\{baseUrl\}\}/, "");
  const normalizedPath = withoutBase
    .replace(/\{\{[^}]+\}\}/g, ":param")
    .replace(/\{[^}]+\}/g, ":param")
    .replace(/:\w+/g, ":param");
  return `${method.toUpperCase()} ${normalizedPath}`;
}

interface ParsedBruRequest {
  readonly filePath: string;
  readonly name: string;
  readonly method: string;
  readonly url: string;
  readonly normalizedRoute: string;
  readonly jsonBody?: string;
  readonly docs: string;
  readonly postResponseScript?: string;
}

function loadBruRequests(): ParsedBruRequest[] {
  const folders = readdirSync(BRUNO_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{2}-/.test(entry.name))
    .map(entry => entry.name)
    .sort();

  const requests: ParsedBruRequest[] = [];
  for (const folder of folders) {
    const folderDir = join(BRUNO_DIR, folder);
    const files = readdirSync(folderDir)
      .filter(name => name.endsWith(".bru") && name !== "folder.bru")
      .sort();

    for (const file of files) {
      const relativePath = `${folder}/${file}`;
      const raw = readFileSync(join(folderDir, file), "utf8");
      const parsed = bruToJsonV2(raw);
      const method = (parsed.http?.method ?? "").toUpperCase();
      const url = parsed.http?.url ?? "";
      requests.push({
        filePath: relativePath,
        name: parsed.meta?.name ?? "",
        method,
        url,
        normalizedRoute: normalizeRoute(method, url),
        jsonBody: parsed.body?.json,
        docs: (parsed.docs ?? "").trim(),
        postResponseScript: parsed.script?.res,
      });
    }
  }
  return requests;
}

function loadNetlifyFunctionRoutes(): Map<string, { file: string; rawRoute: string }> {
  const functionsDir = join(REPO_ROOT, "netlify/functions");
  const map = new Map<string, { file: string; rawRoute: string }>();

  for (const entry of readdirSync(functionsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }
    const source = readFileSync(join(functionsDir, entry.name), "utf8");
    const path = /path:\s*"([^"]+)"/.exec(source)?.[1];
    const method = /method:\s*"([^"]+)"/.exec(source)?.[1];
    if (path && method) {
      map.set(normalizeRoute(method, path), {
        file: entry.name,
        rawRoute: `${method} ${path}`,
      });
    }
  }
  return map;
}

function loadOpenApiImplementedOperations(): Map<string, { operationId: string; rawRoute: string }> {
  const doc = parseYaml(readFileSync(OPENAPI_PATH, "utf8")) as {
    paths: Record<string, Record<string, { "operationId"?: string; "x-implemented"?: boolean }>>;
  };
  const map = new Map<string, { operationId: string; rawRoute: string }>();

  for (const [path, methods] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation?.["x-implemented"] === false || !operation?.operationId) {
        continue;
      }
      map.set(normalizeRoute(method, path), {
        operationId: operation.operationId,
        rawRoute: `${method.toUpperCase()} ${path}`,
      });
    }
  }
  return map;
}

interface OpenApiSchemaNode {
  readonly $ref?: string;
  readonly allOf?: readonly OpenApiSchemaNode[];
  readonly properties?: Record<string, unknown>;
}

/** Property names of a component schema, following local `$ref`s and `allOf`. */
function openApiSchemaPropertyNames(schemaName: string): string[] {
  const doc = parseYaml(readFileSync(OPENAPI_PATH, "utf8")) as {
    components: { schemas: Record<string, OpenApiSchemaNode> };
  };
  const collect = (node: OpenApiSchemaNode): string[] => {
    if (node.$ref) {
      return collect(doc.components.schemas[node.$ref.replace("#/components/schemas/", "")]!);
    }
    return [
      ...Object.keys(node.properties ?? {}),
      ...(node.allOf ?? []).flatMap(collect),
    ];
  };
  return collect(doc.components.schemas[schemaName]!);
}

/** The backticked field names inside the first comma-separated `(...)` list of a docs block. */
function documentedFieldList(docs: string): string[] {
  const list = /\(([^),`]*`[^),]*,[^)]*)\)/.exec(docs)?.[1] ?? "";
  return [
    ...list.matchAll(/`(\w+)`/g),
  ].map(match => match[1]!);
}

describe("bruno manual testing collection and standalone HTML documentation (bruno-api-docs)", () => {
  const bruRequests = loadBruRequests();
  const netlifyRoutes = loadNetlifyFunctionRoutes();
  const openApiOperations = loadOpenApiImplementedOperations();

  it("parses collection.bru, both environments, and all 6 folder.bru files via @usebruno/lang", () => {
    const collection = collectionBruToJson(readFileSync(join(BRUNO_DIR, "collection.bru"), "utf8"));
    expect(collection.docs?.trim().length).toBeGreaterThan(100);
    expect(collection.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "x-api-key", value: "{{apiKey}}" }),
      ]),
    );

    const localEnv = bruToEnvJsonV2(readFileSync(join(BRUNO_DIR, "environments/Local Dev.bru"), "utf8"));
    const prodEnv = bruToEnvJsonV2(readFileSync(join(BRUNO_DIR, "environments/Netlify Production.bru"), "utf8"));
    expect(localEnv.variables.find(v => v.name === "baseUrl")?.value).toBe("http://localhost:8888");
    expect(prodEnv.variables.find(v => v.name === "apiKey")?.secret).toBe(true);

    const folders = readdirSync(BRUNO_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^\d{2}-/.test(entry.name))
      .map(entry => entry.name)
      .sort();
    expect(folders).toHaveLength(6);

    for (const folder of folders) {
      const parsedFolder = collectionBruToJson(readFileSync(join(BRUNO_DIR, folder, "folder.bru"), "utf8"));
      expect(parsedFolder.docs?.trim().length, `${folder}/folder.bru docs`).toBeGreaterThan(20);
    }
  });

  it("covers all 24 implemented Netlify Function routes 1-to-1 with no missing or extra endpoints", () => {
    expect(bruRequests).toHaveLength(24);
    const bruRouteKeys = bruRequests.map(req => req.normalizedRoute).sort();
    const netlifyRouteKeys = [
      ...netlifyRoutes.keys(),
    ].sort();
    expect(bruRouteKeys).toEqual(netlifyRouteKeys);
  });

  it("covers all 23 implemented OpenAPI v1 operations plus GET /api/health", () => {
    const bruV1Routes = bruRequests
      .map(req => req.normalizedRoute)
      .filter(route => route !== "GET /api/health")
      .sort();
    const openApiRouteKeys = [
      ...openApiOperations.keys(),
    ].sort();
    expect(bruV1Routes).toEqual(openApiRouteKeys);
  });

  it("includes a non-empty Markdown docs block on every .bru request file", () => {
    for (const req of bruRequests) {
      expect(req.name.length, `${req.filePath} meta.name`).toBeGreaterThan(3);
      expect(req.docs.length, `${req.filePath} docs block`).toBeGreaterThan(50);
    }
  });

  it("auto-chains tokens and IDs in script:post-response on sign-up, sign-in, create-session, join-session, and submit-chain", () => {
    const byFile = new Map(bruRequests.map(req => [req.filePath, req]));
    expect(byFile.get("02-Instructor-Accounts/01-sign-up-instructor.bru")?.postResponseScript).toContain("accountToken");
    expect(byFile.get("02-Instructor-Accounts/02-sign-in-instructor.bru")?.postResponseScript).toContain("accountToken");
    expect(byFile.get("04-Game-Sessions/01-create-session.bru")?.postResponseScript).toContain("instructorToken");
    expect(byFile.get("04-Game-Sessions/01-create-session.bru")?.postResponseScript).toContain("roomCode");
    expect(byFile.get("04-Game-Sessions/02-join-session.bru")?.postResponseScript).toContain("participantToken");
    expect(byFile.get("05-Chains-and-Adjudication/01-submit-chain.bru")?.postResponseScript).toContain("chainId");
  });

  it("every JSON request body in the Bruno collection satisfies the compiled Ajv OpenAPI request schema", () => {
    const ajv = new Ajv2020({
      strict: true,
      discriminator: true,
      allErrors: true,
      validateFormats: false,
    });

    const sampleVariables: Record<string, string> = {
      teacherEmail: "rahman.s@aku.edu",
      teacherPassword: "correct horse battery",
      packId: "diabe-teach",
      customPackId: "endocrine-intro",
      roomCode: "ABC123",
    };

    for (const req of bruRequests) {
      const openApiOp = openApiOperations.get(req.normalizedRoute);
      if (!openApiOp) {
        continue;
      }
      const schemaEntry = (requestBodySchemas as Record<string, { required: boolean; schema: object } | undefined>)[
        openApiOp.operationId
      ];
      if (!schemaEntry) {
        expect(req.jsonBody, `${req.filePath} should have no JSON body`).toBeUndefined();
        continue;
      }

      expect(req.jsonBody, `${req.filePath} must provide body:json for ${openApiOp.operationId}`).toBeDefined();
      const interpolated = (req.jsonBody ?? "").replace(
        /\{\{(\w+)\}\}/g,
        (_, key: string) => sampleVariables[key] ?? "sample-value",
      );
      const parsedJson = JSON.parse(interpolated) as unknown;
      const validate = ajv.compile(schemaEntry.schema);
      const valid = validate(parsedJson);
      expect(valid, `${req.filePath} (${openApiOp.operationId}): ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it("the pack list docs name exactly the fields of CurriculumPackListItem, and the pack detail docs name isSystemPack", () => {
    const byFile = new Map(bruRequests.map(req => [req.filePath, req]));
    const listDocs = byFile.get("03-Curriculum-Packs/01-list-packs.bru")?.docs ?? "";
    const detailDocs = byFile.get("03-Curriculum-Packs/02-get-pack-by-id.bru")?.docs ?? "";

    expect(documentedFieldList(listDocs).sort()).toEqual(
      openApiSchemaPropertyNames("CurriculumPackListItem").sort(),
    );
    expect(openApiSchemaPropertyNames("CurriculumPackDetail")).toContain("isSystemPack");
    expect(detailDocs).toContain("`isSystemPack`");
  });

  it("generates standalone interactive HTML documentation at docs/api/api-docs.html containing all endpoints and environments", () => {
    expect(existsSync(HTML_DOCS_PATH)).toBe(true);
    const html = readFileSync(HTML_DOCS_PATH, "utf8");
    expect(html).toContain("Diabe-teach Concept-Chain API");
    expect(html).toContain("Local Dev");
    expect(html).toContain("Netlify Production");
    for (const req of bruRequests) {
      expect(html, `HTML docs should contain ${req.name}`).toContain(req.name);
    }
  });
});
