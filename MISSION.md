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

## Out of scope
- Frontend React/Canvas UI rendering of the 7x7 board.
- Replacing REST + OpenAPI 3.1 with GraphQL or gRPC.
