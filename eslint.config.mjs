import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 圈复杂度警告
      "complexity": ["warn", 15],
      // 禁用未使用变量检查
      "@typescript-eslint/no-unused-vars": "off",
      // 禁用空接口检查
      "@typescript-eslint/no-empty-object-type": "off",
      // 禁用 no-explicit-any 检查
      "@typescript-eslint/no-explicit-any": "off",
      // 禁用空块检查
      "no-empty": "off",
    },
  },
  {
    ignores: ["node_modules/", ".next/", "out/"],
  },
);
