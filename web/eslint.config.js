import antfu from "@antfu/eslint-config";

const NO_USE_EFFECT_MESSAGE
  = "useEffect is banned in web/src (ADR-0008). Use TanStack Query (useQuery) for server data/polling, event handlers (onClick/onSubmit) for user actions, and pure functions in web/src/domain/ for derived state.";

const TANSTACK_IN_HOOKS_MESSAGE
  = "Import @tanstack/react-query only in a feature's *-hooks.ts file (e.g. features/accounts/account-hooks.ts), main.tsx or App.tsx. Screens call the named hooks (useSignIn, useCurrentAccount, ...); see web/README.md \"Where code goes\".";

// One restricted import per entry. ESLint does not merge `no-restricted-imports` across config entries
// (a later entry replaces the earlier `paths`), so each entry below lists every path it bans.
const NO_USE_EFFECT_PATH = {
  name: "react",
  importNames: ["useEffect"],
  message: NO_USE_EFFECT_MESSAGE,
};
const NO_TANSTACK_PATH = { name: "@tanstack/react-query", message: TANSTACK_IN_HOOKS_MESSAGE };

// Files allowed to import TanStack Query: the hooks files and the app shell.
const TANSTACK_ALLOWED_FILES = ["src/**/*-hooks.ts", "src/main.tsx", "src/App.tsx"];

export default antfu(
  {
    react: true,
    stylistic: {
      quotes: "double",
      semi: true,
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [NO_USE_EFFECT_PATH, NO_TANSTACK_PATH],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "React",
          property: "useEffect",
          message: NO_USE_EFFECT_MESSAGE,
        },
      ],
    },
  },
  {
    // The hooks files and the app shell may import TanStack Query; useEffect stays banned there too.
    files: TANSTACK_ALLOWED_FILES,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [NO_USE_EFFECT_PATH],
        },
      ],
    },
  },
);
