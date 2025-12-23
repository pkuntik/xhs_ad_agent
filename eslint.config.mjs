import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 禁止使用 any 类型
      "@typescript-eslint/no-explicit-any": "warn",
      // 禁止未使用的变量
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      // 函数最大行数警告
      "max-lines-per-function": ["warn", {
        max: 100,
        skipBlankLines: true,
        skipComments: true
      }],
      // 圈复杂度警告
      "complexity": ["warn", 15],
    },
  },
  {
    ignores: ["node_modules/", ".next/", "out/"],
  },
);
