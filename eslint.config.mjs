import { createRequire } from "module";

const require = createRequire(import.meta.url);
const coreWebVitals = require("eslint-config-next/core-web-vitals");
const typescript = require("eslint-config-next/typescript");
const reactPlugin = require("eslint-plugin-react");

// React Compiler のルールを無効化（このプロジェクトは React Compiler を使用しない）
const reactCompilerRulesOff = {
  "react-hooks/set-state-in-effect": "off",
  "react-hooks/preserve-manual-memoization": "off",
  "react-hooks/incompatible-library": "off",
  "react-hooks/immutability": "off",
  "react-hooks/globals": "off",
  "react-hooks/refs": "off",
  "react-hooks/static-components": "off",
  "react-hooks/use-memo": "off",
  "react-hooks/void-use-memo": "off",
  "react-hooks/component-hook-factories": "off",
  "react-hooks/error-boundaries": "off",
  "react-hooks/purity": "off",
  "react-hooks/set-state-in-render": "off",
  "react-hooks/unsupported-syntax": "off",
  "react-hooks/config": "off",
  "react-hooks/gating": "off",
};

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    plugins: { react: reactPlugin },
    rules: {
      ...reactCompilerRulesOff,
      "react/button-has-type": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default config;
