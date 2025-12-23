import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 圈复杂度警告
      "complexity": ["warn", 15],
    },
  },
  {
    ignores: ["node_modules/", ".next/", "out/"],
  },
);
