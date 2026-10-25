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

## Wisdom (Communities)

- [Netlify Support Forums — Serverless Functions Category](https://answers.netlify.com/c/support/functions/)
  Active practitioner forum with Netlify engineers debugging real-world `netlify.toml`, `included_files`, and cold-start behavior.
- [OpenAPI Initiative Community & Slack (`openapistack` Discussions)](https://github.com/openapistack/openapi-backend/discussions)
  Practitioner discussions on schema-driven routing, security handlers, and serverless cold-start tuning (`quick: true`).
