# Hexagonal Serverless & OpenAPI Pipeline Resources

## Knowledge

- [Documentation: Netlify Functions v2 Overview & Custom URL Routing](https://docs.netlify.com/functions/overview/)
  Official primary source on Web-Standard `Request`/`Response` handlers, `export const config: Config`, and `context.params`. Use for: understanding how Netlify invokes `netlify/functions/api.ts`.
- [Documentation: OpenAPI-Backend (`openapistack/openapi-backend`)](https://github.com/openapistack/openapi-backend#readme)
  Official documentation for `OpenAPIBackend`, `register`, `securityHandlers`, `unauthorizedHandler`, `notFound`, and `notImplemented`. Use for: central `docs/api/openapi.yaml` routing and `ApiKeyAuth` (`x-api-key`) security gates.
- [Article: Hexagonal Architecture (Ports and Adapters) by Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
  Original primary source defining Inbound vs. Outbound ports and adapters. Use for: keeping `src/domain/` and `src/application/` isolated from HTTP and MongoDB.
- [Specification: OpenAPI 3.1.0 Specification](https://spec.openapis.org/oas/v3.1.0)
  Official OAS 3.1.0 standard. Use for: `operationId`, `securitySchemes` (`ApiKeyAuth`, `BearerAuth`), and path parameter schemas in `docs/api/openapi.yaml`.
- [Documentation: MongoDB Node.js Driver Connection Pooling in Serverless](https://www.mongodb.com/docs/drivers/node/current/fundamentals/connection/)
  Official MongoDB guide on reusing `MongoClient` promises across warm AWS Lambda / Netlify Function containers. Use for: `src/adapters/outbound/mongo-client-singleton.ts`.

## Knowledge: React web app (`web/`)

- [Article: You Might Not Need an Effect (react.dev)](https://react.dev/learn/you-might-not-need-an-effect)
  Official React guide on replacing effects with render-time derivation, event handlers and keys. Use for: why `web/src` bans `useEffect` (ADR-0008). **Primary source for lesson 0002.**
- [Reference: `useSyncExternalStore` (react.dev)](https://react.dev/reference/react/useSyncExternalStore)
  Official reference for subscribing to an external store. Use for: `useSignedInAccount` reading the Account Token store.
- [Documentation: TanStack Query, Overview](https://tanstack.com/query/latest/docs/framework/react/overview) and [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
  Official docs for `useQuery` (server reads, polling) and `useMutation` (writes from event handlers).
- [Documentation: React Router, Data Loading](https://reactrouter.com/start/data/data-loading) and [`redirect`](https://reactrouter.com/api/utils/redirect)
  Official docs for route `loader` functions. Use for: the `requireTeacher` guard in `web/src/features/shared/`.
- [Documentation: Testing Library, Guiding Principles](https://testing-library.com/docs/guiding-principles) and [Queries](https://testing-library.com/docs/queries/about)
  "The more your tests resemble the way your software is used, the more confidence they can give you." Use for: the web screen tests.
- [Documentation: Vite, Env Variables and Modes](https://vite.dev/guide/env-and-mode) and [Server Options (proxy)](https://vite.dev/config/server-options)
  Official: `VITE_*` variables are exposed in client code. Use for: the `/api` dev proxy and why the API key must not be a `VITE_` variable.

## Wisdom (Communities)

- [Reactiflux](https://www.reactiflux.com/)
  Large React practitioner chat community (Discord). Use for: real-world review of React patterns such as effect-free data flow.
- [r/reactjs](https://www.reddit.com/r/reactjs/)
  Busy React subreddit with a weekly beginner thread.

- [Netlify Support Forums — Serverless Functions Category](https://answers.netlify.com/c/support/functions/)
  Active practitioner forum with Netlify engineers debugging real-world `netlify.toml`, `included_files`, and cold-start behavior.
- [OpenAPI Initiative Community & Slack (`openapistack` Discussions)](https://github.com/openapistack/openapi-backend/discussions)
  Practitioner discussions on schema-driven routing, security handlers, and serverless cold-start tuning (`quick: true`).
