import { defineConfig } from "vitest/config";

/**
 * Vitest config used only by Stryker (`npm run test:mutation`): the pure
 * domain suites that exercise `src/domain/**` without MongoDB or HTTP, so
 * every mutant runs against fast, in-process tests.
 */
export default defineConfig({
  test: {
    include: ["tests/domain/**/*.test.ts", "tests/property/**/*.test.ts"],
    setupFiles: ["tests/support/vitest-setup.ts"],
    environment: "node",
  },
});
