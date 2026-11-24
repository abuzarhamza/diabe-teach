import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import vitestConfig from "../vitest.config.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TESTS_ROOT = join(REPO_ROOT, "tests");

/** Every test-category folder that `tests/README.md` and wiki 23 document. */
const TEST_FOLDERS = [
  "domain",
  "adapters",
  "functions",
  "contracts",
  "property",
  "fuzz",
  "security",
  "chaos",
  "benchmarks",
  "web",
  "integration",
] as const;

/** Which files count as a folder's checks: BDD features for `integration/`, benches for `benchmarks/`. */
const CHECK_FILE: Record<string, RegExp> = {
  integration: /\.feature$/,
  benchmarks: /\.bench\.ts$/,
};

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory()
      ? filesUnder(full)
      : [full];
  });
}

describe("tests/ folder layout matches tests/README.md and wiki 23 (api-testing-suite 07)", () => {
  const readme = readFileSync(join(TESTS_ROOT, "README.md"), "utf8");
  const wiki = readFileSync(join(REPO_ROOT, "wiki/23-api-testing-taxonomy-and-folder-structure.md"), "utf8");

  it.each(TEST_FOLDERS)("tests/%s/ exists, is documented, and holds at least one check", (folder) => {
    const dir = join(TESTS_ROOT, folder);
    expect(existsSync(dir)).toBe(true);
    expect(readme).toContain(`tests/${folder}/`);
    expect(wiki).toContain(`${folder}/`);

    const pattern = CHECK_FILE[folder] ?? /\.test\.ts$/;
    expect(filesUnder(dir).some(file => pattern.test(file))).toBe(true);
  });

  it("the normal vitest run never picks up *.bench.ts files", () => {
    const include = vitestConfig.test?.include ?? [];
    expect(include).toEqual(["tests/**/*.test.ts"]);
  });

  it("package.json wires `npm run bench` and `npm run test:mutation`", () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.scripts.bench).toBe("vitest bench --run");
    expect(pkg.scripts["test:mutation"]).toBe("stryker run");
    expect(pkg.devDependencies).toHaveProperty("@stryker-mutator/core");
    expect(pkg.devDependencies).toHaveProperty("@stryker-mutator/vitest-runner");
  });
});

describe("stryker.config.mjs targets the domain layer (api-testing-suite 07)", () => {
  it("mutates src/domain/**/*.ts with the vitest runner and an existing, domain-only vitest config", async () => {
    const { default: config } = await import(pathToFileURL(join(REPO_ROOT, "stryker.config.mjs")).href);

    expect(config.testRunner).toBe("vitest");
    expect(config.mutate).toContain("src/domain/**/*.ts");
    expect(config.mutate.every((glob: string) => /^!?src\/domain\//.test(glob))).toBe(true);

    const configFile: string = config.vitest.configFile;
    expect(existsSync(join(REPO_ROOT, configFile))).toBe(true);
    const { default: mutationVitest } = await import(pathToFileURL(join(REPO_ROOT, configFile)).href);
    expect(mutationVitest.test.include).toEqual(["tests/domain/**/*.test.ts", "tests/property/**/*.test.ts"]);
  });

  it("git-ignores Stryker output", () => {
    const gitignore = readFileSync(join(REPO_ROOT, ".gitignore"), "utf8").split("\n");
    expect(gitignore).toContain("reports/");
    expect(gitignore).toContain(".stryker-tmp/");
  });
});
