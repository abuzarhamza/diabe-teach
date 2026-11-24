# 7. Penetration & OWASP API Top 10 Security Tests (`tests/security/`)

Contains **Penetration & API Security Tests** covering OWASP API Security Top 10 attack vectors:
- `owasp-api-security.test.ts` — JWT `alg: "none"` rejection, cross-secret key confusion with forged `kind` claim, payload tampering, the complete 13-endpoint Cross-Session BOLA/IDOR matrix, intra-session role matrix, and NoSQL operator injection rejection.

Run:
```bash
npx vitest run tests/security
```
