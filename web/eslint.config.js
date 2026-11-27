import antfu from "@antfu/eslint-config";

const NO_USE_EFFECT_MESSAGE
  = "useEffect is banned in web/src (ADR-0008). Use TanStack Query (useQuery) for server data/polling, event handlers (onClick/onSubmit) for user actions, and pure functions in web/src/domain/ for derived state.";

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
          paths: [
            {
              name: "react",
              importNames: ["useEffect"],
              message: NO_USE_EFFECT_MESSAGE,
            },
          ],
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
);
