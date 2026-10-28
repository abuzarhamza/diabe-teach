# 02: Role-Based Curriculum Pack Handler & Middy Router

**What to build:** Implement `CurriculumPackHttpHandler` that converts incoming normalized event parameters (`event.pathParameters.packId` and verified capability) directly into `GetCurriculumPackByIdQuery`, executes the use case, and returns the response. Wire this into `@middy/http-router` covering `GET /api/v1/packs/{packId}`.

**Blocked by:** 01: Install Middy Packages & Implement Core Middlewares

**Status:** ready-for-agent

- [ ] Implement `CurriculumPackHttpHandler` with simple event-to-query transformer
- [ ] Connect `CurriculumPackHttpHandler` to `@middy/http-router` for `GET /api/v1/packs/{packId}`
- [ ] Verify role-based answer key projection (redacted for anonymous/participant, unredacted for instructor)
- [ ] Unit and route-level tests verifying clean HTTP responses
