# 4. API Contract & Drift Tests (`tests/contracts/`)

Contains **Contract Tests** (from Cindy Sridharan's `@copyconstruct` testing taxonomy) that verify the API implementation matches its published contracts:
- `openapi-response-schemas.test.ts` — Validates the `200`/`201` and `4xx` response bodies of all 20 `/api/v1/*` routes against compiled `docs/api/openapi.yaml` response schemas in Ajv 2020-12.
- Also see `tests/request-schemas-generated.test.ts` and `tests/bruno-collection-drift.test.ts`.

Run:
```bash
npx vitest run tests/contracts
```
