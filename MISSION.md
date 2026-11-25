# Mission: Mastering the Diabe-Teach Hexagonal Serverless Request Pipeline

## Why
To confidently build, debug, review, and extend all 14 OpenAPI endpoints of the Diabe-Teach platform on Netlify Functions v2 and MongoDB without creating tangled "god modules" or duplicating routing and security logic.

## Success looks like
- Trace any HTTP request step-by-step from `netlify/functions/api.ts` through `openapi-backend`, the Inbound Request Transformer, the Application Use Case, the Domain Aggregate Root, and the Outbound MongoDB Repository.
- Add a new endpoint from `docs/api/openapi.yaml` in under 15 minutes by wiring its `operationId` into `createApp` and writing a pure `transformRequest -> execute` handler.
- Diagnose whether a bug (`401`, `404`, `501`, or wrong DTO projection) lives in the Netlify config, `openapi-backend` security/routing, the Request Transformer, the Use Case, or the Domain Ring.

## Constraints
- Every module must strictly separate interface/contract files (`*.types.ts`, `*.port.ts`, `*.dto.ts`) from class and factory implementations.
- Use everyday `inbound` and `outbound` adapter terminology rather than `driving` and `driven`.
- Rely on established frameworks (`openapi-backend` reading `docs/api/openapi.yaml`) with a single Netlify entrypoint (`netlify/functions/api.ts`).

## React web app (added 2026-11-25)

### Why
To find, change and extend any behaviour of the React web app in `web/` (ADR-0008) with the same confidence as the API, building on prior React knowledge from the Namaste React course.

### Success looks like
- Name the folder and file for any web behaviour in under a minute: a game or error rule (`web/src/domain/`), an HTTP call or browser storage (`web/src/api/`), a screen (`web/src/features/`), a route or guard (`web/src/routes.tsx`).
- Trace a click step by step from a React event handler through `useMutation` / `useQuery`, `apiRequest`, `fetch`, the token store, and back to the screen.
- Write a new screen with no `useEffect`, and a test that drives it through the rendered app over a fake `fetch`.

### Constraints
- `useEffect` is banned in `web/src`; use TanStack Query, event handlers, pure `domain/` functions, `useSyncExternalStore` and `key` instead.
- Only `web/src/api/` may call `fetch` or touch `localStorage` / `sessionStorage`.

## Out of scope
- Replacing REST + OpenAPI 3.1 with GraphQL or gRPC.
