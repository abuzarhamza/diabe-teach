# 05: [PENETRATION / SECURITY TESTS] OWASP API Top 10 & Cross-Session BOLA/IDOR matrix (`tests/security/owasp-api-security.test.ts`)

**Category:** Penetration & API Security Testing (`tests/security/`)

**What to build:** Create `tests/security/` (with `tests/security/README.md`) and build `tests/security/owasp-api-security.test.ts` systematically testing OWASP API Security Top 10 vectors against our handlers and JWT adapters:
1. **API2 — Broken Authentication (JWT Cryptographic & Header Attacks):**
   - `alg: "none"` unsigned JWT tokens (with valid payload claims for both `kind: "account"` and `kind: "capability"`) are rejected with `401 UNAUTHORIZED_TOKEN`.
   - **Cross-secret key confusion with forged `kind` claim:** A JWT signed with `CAPABILITY_TOKEN_SECRET` but carrying `{ kind: "account", sub: accountId }` is rejected on `AccountAuth` routes (`401`), and a JWT signed with `ACCOUNT_TOKEN_SECRET` but carrying `{ kind: "capability", sessionId, role: "instructor" }` is rejected on `BearerAuth` routes (`401`).
   - Tampered payload claims (changing `role: "participant"` to `role: "instructor"` or changing `sessionId` without re-signing) are rejected with `401 UNAUTHORIZED_TOKEN`.
2. **API1 & API5 — Broken Object Level Authorization (BOLA / IDOR) & Function Level Authorization Matrix:**
   - Create **Session A** and **Session B**. Prove across **all 13 session-scoped endpoints** (`getGameSessionState`, `transitionSessionPhase`, `extendSessionPhase`, `endGameSession`, `leaveGameSession`, `submitConceptChain`, `listRoundChains`, `adjudicateConceptChain`, `getRoundStandings`, `submitAssessmentAttempt` [pretest & posttest], `submitPerceptionSurvey`, `getSessionAnalytics`) that:
     - Session A's `instructorToken` and `participantToken` are refused with `403 FORBIDDEN_ROLE` when targeting Session B's `:sessionId`.
     - Within Session A, a learner's `participantToken` is refused with `403 FORBIDDEN_ROLE` on instructor-only operations (`transitionSessionPhase`, `extendSessionPhase`, `endGameSession`, and `instructor-approve`/`instructor-reject` in `adjudicateConceptChain`), and an instructor's `instructorToken` is refused with `403 FORBIDDEN_ROLE` on learner-only write operations (`leaveGameSession`, `submitConceptChain`, `peer-approve`/`peer-challenge`, `submitAssessmentAttempt`, `submitPerceptionSurvey`).
3. **API3 & API8 — NoSQL Operator Injection & Security Misconfiguration:**
   - Payloads embedding MongoDB query operators (`{ "$gt": "" }`, `{ "$ne": null }`, `{ "$where": "1==1" }`) in `email`, `password`, `roomCode`, `packId`, or `answers` are rejected with `400 INVALID_REQUEST_BODY`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `tests/security/README.md` and `tests/security/owasp-api-security.test.ts` exist and pass in Vitest
- [x] Verifies JWT `alg: "none"`, cross-secret key confusion with forged `kind`, and payload tampering rejection (`401`)
- [x] Verifies the complete 13-endpoint Cross-Session BOLA/IDOR matrix and intra-session role matrix (`403 FORBIDDEN_ROLE`)
- [x] Verifies NoSQL operator object injection payloads are rejected (`400 INVALID_REQUEST_BODY`)
