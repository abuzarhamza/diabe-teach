# 6. Fuzz Tests (`tests/fuzz/`)

Contains **Fuzz Tests** (using `fast-check`) that feed arbitrary malformed JSON, Unicode strings, deeply nested objects, `__proto__` / `constructor` keys, extreme numbers, and random headers into `wrapLambdaHandler` + `createApiHandler`:
- `api-handler-fuzz.test.ts` — Proves that no input ever causes an unhandled `500 INTERNAL_ERROR`, stack trace leak, or secret leak.

Run:
```bash
npx vitest run tests/fuzz
```
