# 02: AppRuntime and Seeder Integration

**What to build:** Integrate the YAML configuration loader into `AppRuntime.loadEnvConfig` and `CurriculumPackSeeder.seed` so local commands (`npm run db:seed`) and local test/server runs automatically resolve configuration from `.env.dev.yaml` without requiring manual shell exports.

**Blocked by:** 01: YAML Config Loader Adapter & Contracts

**Status:** done

- [x] Update `AppRuntime.loadEnvConfig` to merge YAML configuration if present, preserving `process.env` precedence
- [x] Update `CurriculumPackSeeder.seed` to resolve MongoDB URI and database name seamlessly via runtime config
- [x] Add integration test verifying seeder connects or resolves config correctly
- [x] Run full test suite, typecheck, and boundary lint to verify clean green state
