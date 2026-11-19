import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createGetCurrentAccountHandler } from "../../netlify/functions/accounts/get-current-account.js";
import { createSignInHandler } from "../../netlify/functions/accounts/sign-in.js";
import { createSignUpHandler } from "../../netlify/functions/accounts/sign-up.js";
import { createGetPackByIdHandler } from "../../netlify/functions/packs/get-pack-by-id.js";
import { Argon2PasswordHasher } from "../../src/adapters/outbound/argon2-password-hasher.js";
import { FakeClock } from "../../src/adapters/outbound/fake-clock.js";
import { HmacAccountTokenAdapter } from "../../src/adapters/outbound/hmac-account-token-adapter.js";
import { HmacCapabilityTokenAdapter } from "../../src/adapters/outbound/hmac-capability-token-adapter.js";
import { InMemoryCurriculumPackRepository } from "../../src/adapters/outbound/in-memory-curriculum-pack-repository.js";
import { InMemoryInstructorAccountRepository } from "../../src/adapters/outbound/in-memory-instructor-account-repository.js";
import { DIABE_TEACH_PACK } from "../../src/domain/curriculum-pack/diabe-teach-pack.js";

const API_KEY = "test-api-key";
// Both token kinds share one secret here on purpose: only the `kind` claim
// keeps them apart, so these tests prove the claim alone is enough.
const SHARED_SECRET = "test-shared-token-secret";
const PASSWORD = "correct horse battery";

type Handler = (event: APIGatewayProxyEvent, context: never) => Promise<unknown>;

function makeWorld() {
  const clock = new FakeClock(new Date("2026-11-19T08:00:00.000Z"));
  const accountRepo = new InMemoryInstructorAccountRepository();
  const accountTokens = new HmacAccountTokenAdapter(SHARED_SECRET, clock);
  const capabilityTokens = new HmacCapabilityTokenAdapter(SHARED_SECRET);
  let nextId = 0;
  const deps = {
    accountRepo,
    passwordHasher: new Argon2PasswordHasher(),
    accountTokenSigner: accountTokens,
    accountTokenVerifier: accountTokens,
    idGenerator: {
      generate: () => `account-${++nextId}`,
    },
    clock,
    packRepo: new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK]),
    tokenVerifier: capabilityTokens,
    apiKey: API_KEY,
    requireApiKey: true,
  };
  return {
    clock,
    accountRepo,
    capabilityTokens,
    signUp: createSignUpHandler(deps) as unknown as Handler,
    signIn: createSignInHandler(deps) as unknown as Handler,
    me: createGetCurrentAccountHandler(deps) as unknown as Handler,
    getPack: createGetPackByIdHandler(deps) as unknown as Handler,
  };
}

function makeEvent(
  method: string,
  path: string,
  options: { body?: unknown; rawBody?: string; token?: string; pathParameters?: Record<string, string> } = {},
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path,
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      ...(options.token
        ? { authorization: `Bearer ${options.token}` }
        : {}),
    },
    body: options.rawBody ?? (options.body === undefined
      ? null
      : JSON.stringify(options.body)),
    isBase64Encoded: false,
    pathParameters: options.pathParameters ?? null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as never,
    resource: "",
  };
}

async function call(handler: Handler, event: APIGatewayProxyEvent) {
  const result = (await handler(event, {} as never)) as APIGatewayProxyResult;
  return {
    status: result.statusCode,
    body: JSON.parse(result.body) as Record<string, unknown>,
  };
}

function signUpEvent(body: unknown) {
  return makeEvent("POST", "/api/v1/accounts/sign-up", { body });
}

function signInEvent(body: unknown) {
  return makeEvent("POST", "/api/v1/accounts/sign-in", { body });
}

describe("post /api/v1/accounts/sign-up", () => {
  it("creates an Instructor Account and returns 201 with an Account Token, its id and email", async () => {
    const world = makeWorld();

    const res = await call(world.signUp, signUpEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));

    expect(res.status).toBe(201);
    expect(res.body.accountId).toBe("account-1");
    expect(res.body.email).toBe("rahman.s@aku.edu");
    expect(typeof res.body.accountToken).toBe("string");
    expect(res.body.expiresAt).toBe("2026-11-19T20:00:00.000Z");
  });

  it("stores the email trimmed and lower-cased", async () => {
    const world = makeWorld();

    const res = await call(world.signUp, signUpEvent({ email: "  Rahman.S@AKU.edu ", password: PASSWORD }));

    expect(res.status).toBe(201);
    expect(res.body.email).toBe("rahman.s@aku.edu");
    expect((await world.accountRepo.findByEmail("rahman.s@aku.edu"))?.accountId).toBe(res.body.accountId);
  });

  it.each([
    ["the same letters", "rahman.s@aku.edu"],
    ["different capitals and surrounding spaces", "  Rahman.S@AKU.edu "],
  ])("refuses an email already registered (%s) with 409", async (_label, secondEmail) => {
    const world = makeWorld();
    await call(world.signUp, signUpEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));

    const res = await call(world.signUp, signUpEvent({ email: secondEmail, password: "another password" }));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(world.accountRepo.storedRecords()).toHaveLength(1);
  });

  it.each([
    [
      "a missing email",
      { password: PASSWORD },
      "email",
    ],
    [
      "an email that is not a string",
      { email: 42, password: PASSWORD },
      "email",
    ],
    [
      "an email without an @",
      { email: "rahman.aku.edu", password: PASSWORD },
      "email",
    ],
    [
      "an email without a domain dot",
      { email: "rahman@aku", password: PASSWORD },
      "email",
    ],
    [
      "a blank email",
      { email: "   ", password: PASSWORD },
      "email",
    ],
    [
      "a missing password",
      { email: "rahman.s@aku.edu" },
      "password",
    ],
    [
      "a 9-character password",
      { email: "rahman.s@aku.edu", password: "123456789" },
      "password",
    ],
  ])("returns 400 and stores nothing for %s", async (_label, body, field) => {
    const world = makeWorld();

    const res = await call(world.signUp, signUpEvent(body));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_REQUEST_BODY");
    expect((res.body.details as Record<string, unknown>).field).toBe(field);
    expect(world.accountRepo.storedRecords()).toHaveLength(0);
  });

  it("accepts a password of exactly 10 characters", async () => {
    const world = makeWorld();

    const res = await call(world.signUp, signUpEvent({ email: "rahman.s@aku.edu", password: "1234567890" }));

    expect(res.status).toBe(201);
  });

  it("returns 400 and stores nothing for a body that is not JSON", async () => {
    const world = makeWorld();

    const res = await call(world.signUp, makeEvent("POST", "/api/v1/accounts/sign-up", { rawBody: "not json" }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_REQUEST_BODY");
    expect(world.accountRepo.storedRecords()).toHaveLength(0);
  });

  it("never stores the plain password", async () => {
    const world = makeWorld();

    await call(world.signUp, signUpEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));

    const [record] = world.accountRepo.storedRecords();
    expect(JSON.stringify(record)).not.toContain(PASSWORD);
    expect(String(record?.passwordHash)).toMatch(/^\$argon2id\$/);
  });
});

describe("post /api/v1/accounts/sign-in", () => {
  async function registeredWorld() {
    const world = makeWorld();
    const signedUp = await call(world.signUp, signUpEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));
    return { world, accountId: signedUp.body.accountId };
  }

  it("returns 200 with an Account Token for the right password", async () => {
    const { world, accountId } = await registeredWorld();

    const res = await call(world.signIn, signInEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));

    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe(accountId);
    expect(res.body.email).toBe("rahman.s@aku.edu");
    expect(typeof res.body.accountToken).toBe("string");
  });

  it("finds the account whatever the email's capitals or surrounding spaces", async () => {
    const { world } = await registeredWorld();

    const res = await call(world.signIn, signInEvent({ email: " RAHMAN.S@aku.edu  ", password: PASSWORD }));

    expect(res.status).toBe(200);
  });

  it("gives a wrong password and an unknown email the same 401 body", async () => {
    const { world } = await registeredWorld();

    const wrongPassword = await call(world.signIn, signInEvent({ email: "rahman.s@aku.edu", password: "not the password" }));
    const unknownEmail = await call(world.signIn, signInEvent({ email: "nobody@aku.edu", password: PASSWORD }));

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual({ code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it("gives a missing password the same 401 body", async () => {
    const { world } = await registeredWorld();

    const res = await call(world.signIn, signInEvent({ email: "rahman.s@aku.edu" }));

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("accountAuth security scheme (GET /api/v1/accounts/me)", () => {
  it("accepts the Account Token returned by sign-up and by sign-in", async () => {
    const world = makeWorld();
    const signedUp = await call(world.signUp, signUpEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));
    const signedIn = await call(world.signIn, signInEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));

    for (const token of [signedUp.body.accountToken, signedIn.body.accountToken]) {
      const res = await call(world.me, makeEvent("GET", "/api/v1/accounts/me", {
        token: String(token),
      }));
      expect(res.status).toBe(200);
      expect(res.body.accountId).toBe(signedUp.body.accountId);
      expect(res.body.email).toBe("rahman.s@aku.edu");
    }
  });

  it("returns 401 with no token", async () => {
    const world = makeWorld();

    const res = await call(world.me, makeEvent("GET", "/api/v1/accounts/me"));

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED_TOKEN");
  });

  it("rejects a Capability Token with 401 (fails closed)", async () => {
    const world = makeWorld();
    const capabilityToken = await world.capabilityTokens.signToken({ role: "instructor", sessionId: "session-1" });

    const res = await call(world.me, makeEvent("GET", "/api/v1/accounts/me", { token: capabilityToken }));

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ code: "UNAUTHORIZED_TOKEN", message: "Malformed, invalid, or expired account token." });
  });

  it("rejects a tampered or garbage token with 401", async () => {
    const world = makeWorld();
    const signedUp = await call(world.signUp, signUpEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));
    const [header, payload, signature] = String(signedUp.body.accountToken).split(".");
    const otherFirst = signature!.startsWith("A")
      ? "B"
      : "A";
    const tampered = `${header}.${payload}.${otherFirst}${signature!.slice(1)}`;

    for (const token of [tampered, "not-a-jwt"]) {
      const res = await call(world.me, makeEvent("GET", "/api/v1/accounts/me", { token }));
      expect(res.status).toBe(401);
    }
  });

  it("rejects an Account Token once its 12 hours have passed", async () => {
    const world = makeWorld();
    const signedUp = await call(world.signUp, signUpEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));
    const token = String(signedUp.body.accountToken);

    world.clock.advanceSeconds(12 * 60 * 60 - 60);
    expect((await call(world.me, makeEvent("GET", "/api/v1/accounts/me", { token }))).status).toBe(200);

    world.clock.advanceSeconds(120);
    expect((await call(world.me, makeEvent("GET", "/api/v1/accounts/me", { token }))).status).toBe(401);
  });
});

describe("bearerAuth security scheme refuses Account Tokens", () => {
  it("returns 401 when an Account Token is sent where a Capability Token is required", async () => {
    const world = makeWorld();
    const signedUp = await call(world.signUp, signUpEvent({ email: "rahman.s@aku.edu", password: PASSWORD }));

    const res = await call(world.getPack, makeEvent("GET", "/api/v1/packs/diabe-teach", {
      token: String(signedUp.body.accountToken),
      pathParameters: { packId: "diabe-teach" },
    }));

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED_TOKEN");
  });

  it("still accepts a Capability Token there", async () => {
    const world = makeWorld();
    const capabilityToken = await world.capabilityTokens.signToken({ role: "instructor", sessionId: "session-1" });

    const res = await call(world.getPack, makeEvent("GET", "/api/v1/packs/diabe-teach", {
      token: capabilityToken,
      pathParameters: { packId: "diabe-teach" },
    }));

    expect(res.status).toBe(200);
  });
});
