import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default [
  {ignores:["dist/**","node_modules/**"]},
  {
    files:["src/**/*.{ts,tsx}"],
    languageOptions:{parser:tseslint.parser,parserOptions:{ecmaVersion:"latest",sourceType:"module",ecmaFeatures:{jsx:true}}},
    plugins:{"react-hooks":hooks},
    rules:{
      ...js.configs.recommended.rules,
      "no-undef":"off", // TypeScript verifies names, including DOM and test globals.
      "no-unused-vars":"off", // TypeScript verifies unused declarations.
      "no-empty":["error",{allowEmptyCatch:true}],
      "react-hooks/rules-of-hooks":"error",
    },
  },
];
