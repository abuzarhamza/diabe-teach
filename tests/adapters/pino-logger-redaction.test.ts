import type { LoggerPort } from "../../src/application/ports/logger.port.js";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Argon2PasswordHasher } from "../../src/adapters/outbound/argon2-password-hasher.js";
import { HmacAccountTokenAdapter } from "../../src/adapters/outbound/hmac-account-token-adapter.js";
import { HmacCapabilityTokenAdapter } from "../../src/adapters/outbound/hmac-capability-token-adapter.js";
import { MongoCredentialStripper } from "../../src/adapters/outbound/mongo-credential-stripper.js";
import { PinoLogger, REDACT_PATHS } from "../../src/adapters/outbound/pino-logger.js";
import { InMemoryLogSink } from "../support/in-memory-log-sink.js";

const WRITE_METHODS = ["debug", "info", "warn", "error"] as const;

interface Secrets {
  readonly capabilityToken: string;
  readonly accountToken: string;
  readonly password: string;
  readonly passwordHash: string;
  readonly email: string;
  readonly bodyMarker: string;
  readonly mongoUser: string;
  readonly mongoPassword: string;
  readonly mongoUri: string;
}

/**
 * Real-looking secrets: the tokens come from the app's own issuers and the
 * hash from its own hasher, all with throwaway random keys and values.
 */
async function makeSecrets(): Promise<Secrets> {
  const throwawayKey = randomBytes(32).toString("hex");
  const email = "rahman.s@aku.edu";
  const capabilityToken = await new HmacCapabilityTokenAdapter(throwawayKey).signToken({
    role: "instructor",
    sessionId: "session-redaction-test",
  });
  const { token: accountToken } = await new HmacAccountTokenAdapter(throwawayKey).signAccountToken(
    { accountId: "account-redaction-test", email },
    new Date(),
  );
  const password = `pw-${randomBytes(6).toString("hex")}`;
  const mongoUser = `user${randomBytes(4).toString("hex")}`;
  const mongoPassword = `pass${randomBytes(8).toString("hex")}`;
  return {
    capabilityToken,
    accountToken,
    password,
    passwordHash: await new Argon2PasswordHasher().hash(password),
    email,
    bodyMarker: `body-${randomBytes(6).toString("hex")}`,
    mongoUser,
    mongoPassword,
    mongoUri: `mongodb+srv://${mongoUser}:${mongoPassword}@cluster0.example.mongodb.net/diabe_teach`,
  };
}

/** Pushes every secret, top-level and nested, through each method and through `child()`. */
function logEverySecret(logger: LoggerPort, s: Secrets): void {
  const fields = {
    authorization: `Bearer ${s.accountToken}`,
    headers: { authorization: `Bearer ${s.capabilityToken}` },
    req: {
      headers: { authorization: `Bearer ${s.accountToken}` },
    },
    token: s.capabilityToken,
    accountToken: s.accountToken,
    instructorToken: s.capabilityToken,
    participantToken: s.capabilityToken,
    password: s.password,
    passwordHash: s.passwordHash,
    email: s.email,
    account: { email: s.email, passwordHash: s.passwordHash },
    signUp: {
      body: { email: s.email, password: s.password },
    },
    body: JSON.stringify({ email: s.email, password: s.password, note: s.bodyMarker }),
    mongodbUri: s.mongoUri,
    config: { uri: s.mongoUri },
    sessionId: "session-redaction-test",
  };
  for (const method of WRITE_METHODS) {
    logger[method](fields, `${method} with secrets`);
  }
  const child = logger.child({
    headers: { authorization: `Bearer ${s.accountToken}` },
    email: s.email,
    account: { email: s.email },
  });
  for (const method of WRITE_METHODS) {
    child[method](fields, `child ${method} with secrets`);
  }
  child.child({ accountToken: s.accountToken }).info({ sessionId: "session-redaction-test" }, "grandchild");
}

/** Short prefixes of the secrets found in `raw`, so a failure never prints a whole secret. */
function leakedSecrets(raw: string, s: Secrets): string[] {
  const values = [
    s.capabilityToken,
    s.accountToken,
    s.password,
    s.passwordHash,
    s.email,
    s.bodyMarker,
    s.mongoUser,
    s.mongoPassword,
    "Bearer ",
  ];
  return values.filter(value => raw.includes(value)).map(value => `${value.slice(0, 6)}…`);
}

describe("pinoLogger redaction (structured-logging ticket 04)", () => {
  it("writes none of the secrets through debug, info, warn, error and child()", async () => {
    const secrets = await makeSecrets();
    const sink = new InMemoryLogSink();
    logEverySecret(PinoLogger.create({ level: "debug", destination: sink }), secrets);

    const lines = sink.lines();
    expect(lines).toHaveLength(9);
    expect(lines.every(line => line.sessionId === "session-redaction-test")).toBe(true);
    expect(leakedSecrets(sink.raw, secrets)).toEqual([]);
  });

  it("leaks all of them with an empty redact list, so the test above really checks redaction", async () => {
    const secrets = await makeSecrets();
    const sink = new InMemoryLogSink();
    logEverySecret(PinoLogger.create({ level: "debug", destination: sink, redactPaths: [] }), secrets);

    expect(leakedSecrets(sink.raw, secrets)).toHaveLength(9);
  });

  it("lists every key at depth 0, 1 and 2, since each `*` in a pino path matches exactly one key", () => {
    expect(REDACT_PATHS).toEqual(expect.arrayContaining([
      "authorization",
      "*.authorization",
      "*.*.authorization",
      "*.token",
      "*.email",
      "*.body",
      "*.uri",
      "*.mongodbUri",
    ]));
  });

  it("strips MongoDB credentials from a logged error's message and stack", async () => {
    const secrets = await makeSecrets();
    const sink = new InMemoryLogSink();
    const logger = PinoLogger.create({ level: "error", destination: sink });

    logger.error({
      err: new Error(`connect failed for ${secrets.mongoUri}`),
    }, "mongo down");

    expect(sink.raw).not.toContain(secrets.mongoPassword);
    expect(sink.raw).not.toContain(secrets.mongoUser);
    const [line] = sink.lines();
    expect((line?.err as { message: string }).message)
      .toBe("connect failed for mongodb+srv://cluster0.example.mongodb.net/diabe_teach");
  });
});

describe("mongoCredentialStripper", () => {
  it.each([
    [
      "MongoServerSelectionError: mongodb+srv://u:p%40ss@cluster0.x.mongodb.net/db?retryWrites=true",
      "MongoServerSelectionError: mongodb+srv://cluster0.x.mongodb.net/db?retryWrites=true",
    ],
    [
      "bad auth for mongodb://admin:hunter2@localhost:27017,localhost:27018/db",
      "bad auth for mongodb://localhost:27017,localhost:27018/db",
    ],
    [
      "unencoded @ in password: MONGODB://user:pa@ss@host/db and more",
      "unencoded @ in password: MONGODB://host/db and more",
    ],
    [
      "two: mongodb://a:b@h1/x then mongodb+srv://c:d@h2/y",
      "two: mongodb://h1/x then mongodb+srv://h2/y",
    ],
    ["no credentials: mongodb://localhost:27017/db", "no credentials: mongodb://localhost:27017/db"],
    ["no uri at all", "no uri at all"],
  ])("strips %j", (input, expected) => {
    expect(MongoCredentialStripper.strip(input)).toBe(expected);
  });
});
