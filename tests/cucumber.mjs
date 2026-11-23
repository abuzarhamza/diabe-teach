/**
 * Cucumber.js ESM configuration for TypeScript support.
 * @see https://github.com/cucumber/cucumber-js/blob/main/docs/esm.md
 *
 * Scenarios always run one at a time in a single process: `parallel: 0` starts
 * no worker processes. `npm run test:bdd` goes further and runs each feature
 * file in its own cucumber process, one after another
 * (scripts/run-bdd-sequential.ts), using the `single` profile below.
 */
const shared = {
  import: [
    "tests/integration/support/**/*.ts",
    "tests/integration/step-definitions/**/*.ts",
  ],
  format: [
    "progress-bar",
    "summary",
  ],
  requireModule: [],
  parallel: 0,
  retry: 0,
  publishQuiet: true,
};

/** Every feature in one run (used when cucumber is invoked directly). */
export default {
  ...shared,
  paths: ["tests/integration/features/**/*.feature"],
};

/** No feature paths: the caller passes exactly one feature file. */
export const single = {
  ...shared,
  format: ["summary"],
};
