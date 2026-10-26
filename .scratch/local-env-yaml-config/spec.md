# Spec: Local Development Environment Configuration via `.env.dev.yaml`

Status: ready-for-agent

## Problem Statement

Developers and automation tools running the Concept-Chain Educational Game Platform locally (e.g. running seed scripts like `scripts/seed-curriculum-packs.ts`, local test runners, or local function handlers) need to connect to target development environments like MongoDB Atlas (`concept_chain_dev`). 

Currently, configuration values (`MONGODB_URI`, `MONGODB_DB_NAME`, `CAPABILITY_TOKEN_SECRET`, `API_KEY`) are read strictly from `process.env`. Requiring developers to export shell environment variables manually or rely on fragile shell scripts is error-prone, risks exposing credentials in shell history, and complicates local workflow execution. Furthermore, sensitive environment configuration files must never be committed to git.

There needs to be a standard, clean mechanism to load local configuration from `.env.dev.yaml` into development workflows with graceful fallbacks, while preserving strict security boundaries and Hexagonal DDD architecture.

## Solution

Provide a dedicated, class-based local configuration loader that reads `.env.dev.yaml` (if present) into runtime configuration:
1. Support loading structured YAML configuration covering database credentials (`mongodb.uri`, `mongodb.database`) and security credentials (`auth.capability_token_secret`, `auth.api_key`).
2. Integrate smoothly with `AppRuntime.loadEnvConfig` so that environment variables in `process.env` take precedence or merge seamlessly with `.env.dev.yaml`.
3. Update local scripts (e.g., `CurriculumPackSeeder.seed`) and development runners to automatically resolve configuration using the local config loader when running outside managed cloud environments.
4. Guarantee that local `.env.dev.yaml` files remain strictly excluded from git tracking while maintaining `.env.dev.yaml.example` as a checked-in template for developers.

## User Stories

1. As a developer running `npm run db:seed` locally, I want the seeder to automatically load MongoDB Atlas credentials and target database from `.env.dev.yaml` without manually exporting environment variables in my shell.
2. As a developer without a `.env.dev.yaml` file, I want the configuration loader to gracefully fall back to existing `process.env` variables without crashing.
3. As a platform operator running in CI or production Netlify environments, I want environment variables set in `process.env` to take precedence over any local file so cloud deployment configurations are never overridden.
4. As a developer creating a new workspace, I want an example template `.env.dev.yaml.example` committed to the repository so I know the exact structure of configuration options.
5. As a security reviewer, I want `.gitignore` to ensure `.env.dev.yaml` and all `.env*` secret files cannot be committed accidentally to version control.
6. As a developer running integration or local runtime verification tests, I want helper methods on `AppRuntime` or the config loader to inspect the loaded configuration without leaking secrets to console logs.
7. As a backend developer, I want the YAML configuration loader to be class-based with strict TypeScript interface definitions in dedicated contract files, adhering to the project's coding standards.

## Implementation Decisions

- **Dedicated Class-Based Config Loader**:
  - Implement a dedicated class responsible for locating, parsing, and resolving `.env.dev.yaml` into a structured configuration object.
  - The loader provides typed methods for reading the YAML file and populating or merging into runtime configuration.
  - Separate contracts and interfaces into a dedicated types file following repository conventions.
- **Precedence & Fallback Rules**:
  - `process.env` values take precedence over file-based values. If a variable is defined in `process.env`, it overrides the value loaded from `.env.dev.yaml`.
  - If `.env.dev.yaml` does not exist on disk, the loader quietly returns empty or default settings without throwing unexpected errors.
- **Seeder and Tooling Integration**:
  - Update `CurriculumPackSeeder` to use the unified configuration resolution so running the seed script locally works out-of-the-box with `.env.dev.yaml`.
- **Runtime Layering & Hexagonal Architecture**:
  - Keep configuration loading logic out of the Domain and Application rings.
  - The loader lives in the runtime/adapter layer, maintaining pure Domain and Application boundaries.

## Testing Decisions

- **Testing External Behavior**:
  - Test the loader's behavior when given a valid YAML configuration string or path, verifying mapped keys and values.
  - Test fallback behavior when the configuration file is missing or contains empty values.
  - Test precedence behavior: ensure explicit `process.env` entries override `.env.dev.yaml` entries.
  - Test integration with seeder options resolution to ensure correct URI and database extraction.
- **Prior Art**:
  - Modeled after unit and integration tests in `tests/get-pack-by-id.test.ts` and `src/app-runtime.ts` unit tests.

## Out of Scope

- Cloud secret management services (e.g. AWS Secrets Manager, HashiCorp Vault).
- Dynamic secret rotation at runtime.
- Multi-tenancy database switching.

## Further Notes

- Target development database is `concept_chain_dev` as specified in ADR-0003.
- Example template is maintained at `.env.dev.yaml.example`.
