# 01: Parse OpenAPI Definition with standard `yaml` module in `OpenApiHttpApp`

**What to build:** Update `OpenApiHttpApp` to read `docs/api/openapi.yaml` and parse it with the standard `yaml` package (`parse as parseYaml`) before passing the parsed object into `OpenAPIBackend`, supporting optional in-memory definition injection.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Read and parse `docs/api/openapi.yaml` using `yaml.parse`
- [x] Pass parsed OpenAPI document object into `OpenAPIBackend` constructor
- [x] Support optional pre-parsed `definition` in `AppDependencies` for zero-disk-I/O testing
- [x] Verify clean pass across unit tests, ESLint, typecheck, and dependency boundary linters
