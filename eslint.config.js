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
);
