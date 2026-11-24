// @ts-check
/**
 * Domain mutation testing (`npm run test:mutation`). Mutates the pure domain
 * layer only and kills mutants with the in-process domain + property suites
 * (see `stryker.vitest.config.ts`). Heavy: run it deliberately, one at a time;
 * pass `--mutate <file>` to scope a run to a single domain file.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  testRunner: "vitest",
  vitest: {
    configFile: "stryker.vitest.config.ts",
    related: false,
  },
  mutate: [
    "src/domain/**/*.ts",
    "!src/domain/**/*.types.ts",
  ],
  ignorePatterns: [
    ".scratch",
    ".show-me",
    "openwiki",
    "web",
    "papers",
    "reference",
    "learning-records",
    "lessons",
    "assets",
    "claudPoc",
    "coverage",
    "reports",
    "docs",
  ],
  coverageAnalysis: "perTest",
  concurrency: 1,
  timeoutMS: 10000,
  reporters: [
    "clear-text",
    "progress",
    "html",
    "json",
  ],
  htmlReporter: { fileName: "reports/mutation/mutation.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
  thresholds: { high: 80, low: 60, break: null },
};

export default config;
