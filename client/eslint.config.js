import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "src/page/home/HomeFun.jsx",
      "src/**/*.ts",
      "src/**/*.tsx",
    ],
  },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        Blob: "readonly",
        Buffer: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        document: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        localStorage: "readonly",
        module: "readonly",
        performance: "readonly",
        process: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
        WebSocket: "readonly",
        window: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "no-dupe-keys": "error",
      "no-eval": "warn",
      "no-unused-vars": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
