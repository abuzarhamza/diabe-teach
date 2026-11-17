# Decision: SSE stream deferred

**2026-11-17.** Claude recommended deferring `GET /api/v1/sessions/{sessionId}/stream`; the user moved on to timer design without objecting. Recorded as Out of Scope in the [spec](../spec.md).

- Reasons: Netlify Functions have short execution limits; there is no shared pub/sub across invocations (`SessionEventPublisherPort` did not exist as of `b368e85`); and polling `GET /sessions/{id}` is adequate at classroom scale.
- As of `b368e85`, `SseEventEnvelope.data` was untyped (`additionalProperties: true`) and nothing emitted events.
- Still open: whether to mark `/stream` as deferred in the OpenAPI spec or in an ADR.
- Related: [timed or instructor-driven phases](decision-timed-or-instructor-driven-phases.md).
