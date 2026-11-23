// Pre-commit: auto-fix staged code with ESLint, then let lint-staged re-stage it.
// Errors ESLint cannot fix are printed but never block the commit, because the
// repo still carries older lint errors. `npm run lint` remains the real gate.
import { ESLint } from "eslint";

export default {
  "*.{ts,js,mjs}": {
    title: "eslint --fix (non-blocking)",
    task: async (files, { log }) => {
      const eslint = new ESLint({ fix: true, warnIgnored: false });
      const results = await eslint.lintFiles(files);
      await ESLint.outputFixes(results);

      const remaining = results.filter(r => r.errorCount + r.warningCount > 0);
      if (remaining.length === 0) {
        log("eslint --fix: no problems left in staged files.");
        return;
      }
      const formatter = await eslint.loadFormatter("stylish");
      log("eslint --fix: problems left that need a manual fix (commit not blocked):");
      log(await formatter.format(remaining));
    },
  },
};
