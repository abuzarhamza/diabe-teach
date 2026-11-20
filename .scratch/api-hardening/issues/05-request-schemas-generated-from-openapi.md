# 05: Request schemas are generated from openapi.yaml (prefactor)

**What to build:** A build-time script resolves `docs/api/openapi.yaml` (with `$ref`s resolved) into a committed module of JSON Schemas for each operation's request body, keyed by operationId. Nothing at runtime uses the module yet, and `openapi.yaml` is still not read at runtime. A test regenerates the module in memory and fails if the committed copy is stale. Where the contract is wrong about what the code really accepts, fix `openapi.yaml`, for example `stepRationales` is documented as objects but used as strings. List each such fix in the Resolution.

See spec: `.scratch/api-hardening/spec.md`.

**Blocked by:** None (can start immediately; run after 04 so only one agent works at a time)

**Status:** ready-for-agent

- [ ] An npm script regenerates the schema module, using a well-known OpenAPI/`$ref` resolver package (ADR-0005), with no hand-written parser
- [ ] Test: the committed module matches a fresh generation, and fails when `openapi.yaml` changes without regenerating
- [ ] Every operation with a request body has a schema in the module
- [ ] Contract fixes, such as `stepRationales`, are listed in the Resolution
- [ ] Typecheck, vitest, lint and boundaries are no worse
