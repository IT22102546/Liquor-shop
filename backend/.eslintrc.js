module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint/eslint-plugin"],
  extends: ["plugin:@typescript-eslint/recommended"],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: [
    ".eslintrc.js",
    "dist",
    "node_modules",
    "**/*.spec.ts",
    "**/tests/**",
  ],
  rules: {
    // TypeScript strict rules
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/explicit-module-boundary-types": "warn",
    "@typescript-eslint/no-explicit-any": "warn", // Changed to warn for easier development
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/ban-types": "error",
    "@typescript-eslint/no-floating-promises": "warn",
    "@typescript-eslint/no-misused-promises": "warn",
    "@typescript-eslint/await-thenable": "warn",
    "@typescript-eslint/no-unnecessary-type-assertion": "warn",

    // Code quality rules
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error",
    eqeqeq: ["error", "always"],
    curly: ["error", "all"],

    // Import rules
    "no-duplicate-imports": "error",
  },
};
