import antfu from "@antfu/eslint-config";

export default antfu(
  {
    typescript: true,
    jsonc: true,
    yaml: true,
    stylistic: {
      semi: true,
      quotes: "double",
      indent: 2,
    },
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.netlify/**",
      "**/.scratch/**",
      "**/wiki/**",
      "**/assets/**",
      "docs/**",
      "src/**/*.generated.ts",
    ],
  },
  {
    rules: {
      "node/prefer-global/process": "off",
      "node/prefer-global/buffer": "off",
    },
  },
  {
    // The API logs only through the LoggerPort (structured-logging 03); scripts/ is exempt.
    files: ["src/**", "netlify/**"],
    rules: {
      // Options given explicitly: a bare "error" would keep antfu's allow list (warn, error).
      "no-console": ["error", {}],
    },
  },
);
