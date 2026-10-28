# Spec: Explicit OpenAPI Definition Parsing via standard `yaml` module in `OpenApiHttpApp`

Status: ready-for-agent

## Problem Statement

In the serverless HTTP driving adapter layer, `OpenApiHttpApp` currently passes a file path string (`docs/api/openapi.yaml`) directly into `new OpenAPIBackend({ definition: OpenApiHttpApp.#OPENAPI_YAML_PATH })`. 

Under the hood, `openapi-backend` delegates path resolution to internal secondary parsers (`@apidevtools/json-schema-ref-parser` and bundled `js-yaml`). This has several disadvantages:
1. **Inconsistency**: The platform standardized on the modern `yaml` package (documented in `wiki/21-npm-first-and-yaml-parser-evaluation.md` and `AGENTS.md`), yet OpenAPI loading relies on implicit internal multi-level file resolvers.
2. **Serverless Packaging Fragility**: In Netlify serverless deployment (AWS Lambda bundling), resolving relative file paths at runtime (`process.cwd() + "/docs/api/openapi.yaml"`) requires specific bundling configurations (`included_files = ["docs/api/openapi.yaml"]`) and can fail if the working directory differs across execution contexts.
3. **Redundant Bundled Dependencies**: Explicitly reading and parsing OpenAPI definitions with the project's standard `yaml` package makes definition loading deterministic, faster, and aligned with our `yaml` standard.

## Solution

Update `OpenApiHttpApp` to parse `docs/api/openapi.yaml` explicitly using the canonical `yaml` npm module before passing the parsed OpenAPI definition object into `OpenAPIBackend`:
1. Use `yaml.parse(...)` to deserialize the OpenAPI specification document into a strongly typed or structured document object.
2. Pass the pre-parsed definition directly to `new OpenAPIBackend({ definition: parsedDocument, ... })`.
3. Provide an optional constructor or factory override to pass an in-memory definition object or custom YAML string, making testing fast, deterministic, and decoupled from disk I/O.
4. Maintain 100% backward compatibility for all existing route operations, security handlers (`ApiKeyAuth`, `BearerAuth`), and error handlers.

## User Stories

1. As a platform developer, I want `OpenApiHttpApp` to use the standard `yaml` package to parse the OpenAPI contract, so that all YAML parsing across the codebase adheres to a single canonical parser.
2. As a serverless runtime engineer, I want `OpenApiHttpApp` to support loading pre-parsed OpenAPI specification objects, so that cold-start initialization does not depend on implicit file path resolution.
3. As a test author, I want to instantiate `OpenApiHttpApp` with custom in-memory OpenAPI definitions without writing temporary YAML files to disk.
4. As an API client, when calling `GET /api/v1/packs/{packId}`, I want the OpenAPI router to function identically with zero regressions in route matching, validation, or security handlers.
5. As an architect verifying boundary rules, I want `dependency-cruiser` to confirm that importing `yaml` inside `src/adapters/inbound/http/` respects all Hexagonal DDD ring boundaries.

## Implementation Decisions

- **Explicit Parsing with `yaml` in Inbound HTTP Adapter**:
  - `OpenApiHttpApp` loads the YAML file content via `readFileSync` and parses it synchronously with `yaml.parse(yamlContent)`.
  - The parsed definition is passed directly to `new OpenAPIBackend({ definition: parsedDefinition, quick: true, validate: false })`.
- **Flexible Definition Sourcing**:
  - Allow an optional parameter in `AppDependencies` or a static loader helper allowing callers to inject an already-parsed OpenAPI document, enabling zero-disk-I/O test environments.
- **Architectural Boundary Compliance**:
  - The `yaml` module is used in outbound adapters (for `.env.dev.yaml`) and inbound adapters (for `openapi.yaml`), while domain and application rings remain 100% pure.

## Testing Decisions

- **External Behavior Verification**:
  - Test that `OpenApiHttpApp` successfully initializes and dispatches requests when initialized via `yaml.parse`.
  - Test that security handlers (`ApiKeyAuth`, `BearerAuth`) operate without regression.
  - Test that invalid YAML content is caught with an informative initialization error.
- **Prior Art**:
  - Modeled after tests in `tests/get-pack-by-id.test.ts` and `tests/env-yaml-config-loader.test.ts`.

## Out of Scope

- Modifying the OpenAPI 3.1 specification schema itself.
- Replacing `openapi-backend` with another routing engine.

## Further Notes

- Evaluated in `wiki/21-npm-first-and-yaml-parser-evaluation.md`.
- Adheres to `Dependency selection: Use popular npm modules first` in `AGENTS.md`.
