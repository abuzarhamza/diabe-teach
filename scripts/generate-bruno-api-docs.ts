import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COLLECTION_DIR = join(REPO_ROOT, "docs/api/bruno");
const OUTPUT_FILE = join(REPO_ROOT, "docs/api/api-docs.html");
const BRU_BIN = join(REPO_ROOT, "node_modules/@usebruno/cli/bin/bru.js");

execFileSync(
  process.execPath,
  [
    BRU_BIN,
    "docs",
    "generate",
    "--all-envs",
    "--output",
    OUTPUT_FILE,
  ],
  {
    cwd: COLLECTION_DIR,
    stdio: "inherit",
  },
);
