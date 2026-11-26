import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const depcruiseConfig = require("../../.dependency-cruiser.cjs") as {
  forbidden: Array<{
    name: string;
    from: { path?: string };
    to: { path?: string };
  }>;
};

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const WEB_ROOT = join(REPO_ROOT, "web");

describe("web 3-layer Simple DDD guardrails (ADR-0008, react-web-setup 02)", () => {
  const eslint = new ESLint({
    cwd: WEB_ROOT,
    overrideConfigFile: join(WEB_ROOT, "eslint.config.js"),
  });

  it("passes standalone Antfu React ESLint with 0 errors on web/src/App.tsx and web/src/main.tsx", async () => {
    const results = await eslint.lintFiles(["src/App.tsx", "src/main.tsx"]);
    const messages = results.flatMap(res => res.messages);
    expect(messages).toEqual([]);
  });

  it("forbids importing useEffect from react inside web/src/", async () => {
    const code = [
      "import { useEffect } from \"react\";",
      "",
      "export function BadComponent() {",
      "  useEffect(() => {}, []);",
      "  return <div />;",
      "}",
      "",
    ].join("\n");

    const [result] = await eslint.lintText(code, {
      filePath: join(WEB_ROOT, "src/features/BadComponent.tsx"),
    });
    const ruleIds = result!.messages.map(msg => msg.ruleId);
    expect(ruleIds).toContain("no-restricted-imports");
    expect(result!.messages.some(msg => msg.message.includes("useEffect is banned in web/src (ADR-0008)"))).toBe(true);
  });

  it("forbids calling React.useEffect inside web/src/", async () => {
    const code = [
      "import * as React from \"react\";",
      "",
      "export function BadNamespaceComponent() {",
      "  React.useEffect(() => {}, []);",
      "  return <div />;",
      "}",
      "",
    ].join("\n");

    const [result] = await eslint.lintText(code, {
      filePath: join(WEB_ROOT, "src/features/BadNamespaceComponent.tsx"),
    });
    const ruleIds = result!.messages.map(msg => msg.ruleId);
    expect(ruleIds).toContain("no-restricted-properties");
    expect(result!.messages.some(msg => msg.message.includes("useEffect is banned in web/src (ADR-0008)"))).toBe(true);
  });

  it("forbids importing @tanstack/react-query in a screen (react-login-screen 06)", async () => {
    const code = [
      "import { useQuery } from \"@tanstack/react-query\";",
      "",
      "export function BadScreen() {",
      "  const query = useQuery({ queryKey: [\"x\"], queryFn: async () => 1 });",
      "  return <div>{query.data}</div>;",
      "}",
      "",
    ].join("\n");

    const [result] = await eslint.lintText(code, {
      filePath: join(WEB_ROOT, "src/features/accounts/BadScreen.tsx"),
    });
    const restricted = result!.messages.filter(msg => msg.ruleId === "no-restricted-imports");
    expect(restricted.some(msg => msg.message.includes("*-hooks.ts"))).toBe(true);
  });

  it("allows @tanstack/react-query in a *-hooks.ts file, and still bans useEffect there", async () => {
    const hooksCode = [
      "import { useQuery } from \"@tanstack/react-query\";",
      "",
      "export function useThing() {",
      "  return useQuery({ queryKey: [\"thing\"], queryFn: async () => 1 });",
      "}",
      "",
    ].join("\n");
    const [accepted] = await eslint.lintText(hooksCode, {
      filePath: join(WEB_ROOT, "src/features/accounts/thing-hooks.ts"),
    });
    expect(accepted!.messages.filter(msg => msg.ruleId === "no-restricted-imports")).toEqual([]);

    const effectCode = [
      "import { useEffect } from \"react\";",
      "",
      "export function useBadThing() {",
      "  useEffect(() => {}, []);",
      "}",
      "",
    ].join("\n");
    const [refused] = await eslint.lintText(effectCode, {
      filePath: join(WEB_ROOT, "src/features/accounts/bad-thing-hooks.ts"),
    });
    expect(refused!.messages.some(msg => msg.message.includes("useEffect is banned in web/src (ADR-0008)"))).toBe(true);
  });

  it("enforces web-domain-stays-pure and web-api-no-react-or-features in .dependency-cruiser.cjs", () => {
    const domainRule = depcruiseConfig.forbidden.find(rule => rule.name === "web-domain-stays-pure");
    const apiRule = depcruiseConfig.forbidden.find(rule => rule.name === "web-api-no-react-or-features");

    expect(domainRule).toBeDefined();
    expect(apiRule).toBeDefined();

    const domainFrom = new RegExp(domainRule!.from.path!);
    const domainTo = new RegExp(domainRule!.to.path!);
    expect(domainFrom.test("web/src/domain/chain-path.ts")).toBe(true);
    expect(domainTo.test("web/src/api/http-client.ts")).toBe(true);
    expect(domainTo.test("web/src/features/App.tsx")).toBe(true);
    expect(domainTo.test("node_modules/react/index.js")).toBe(true);
    expect(domainTo.test("web/src/domain/phase-timer.ts")).toBe(false);

    const apiFrom = new RegExp(apiRule!.from.path!);
    const apiTo = new RegExp(apiRule!.to.path!);
    expect(apiFrom.test("web/src/api/http-client.ts")).toBe(true);
    expect(apiTo.test("web/src/features/accounts/LoginPage.tsx")).toBe(true);
    expect(apiTo.test("node_modules/react/index.js")).toBe(true);
    expect(apiTo.test("web/src/domain/session-phase.ts")).toBe(false);
  });
});
