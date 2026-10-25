# Teaching Notes & Learner Preferences

- **Terminology preference**: Always use **`inbound`** (`src/adapters/inbound/`) and **`outbound`** (`src/adapters/outbound/`) instead of `driving` and `driven`.
- **Module design preference**: Strictly separate TypeScript interfaces/contracts (`*.types.ts`, `*.port.ts`, `*.dto.ts`) from classes and factory functions—never create "god modules" that mix both in one file.
- **Routing preference**: Use established libraries (`openapi-backend` reading `docs/api/openapi.yaml`) with **one single entrypoint** (`netlify/functions/api.ts` -> `createApp`) rather than custom routers or scattered per-endpoint Netlify function files.
- **Visual learning style**: Prefers clear, step-by-step end-to-end execution traces showing how a request flows from Netlify into the codebase and back out as an HTTP response.
