import nx from "@nx/eslint-plugin";
import tseslint from "typescript-eslint";
import { constraints, nodePackages } from "./tools/eslint/boundaries.mjs";
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "dist/**",
      ".local/**",
      "**/*.d.ts",
      "tools/setup/**",
    ],
  },
  ...tseslint.configs.recommended,
 {files:["apps/admin/src/**/*.{ts,tsx}","libs/shared/{ui,auth-client,api-client,permissions,tokens}/src/**/*.{ts,tsx}"],rules:{"no-restricted-imports":["error",{patterns:nodePackages}]}},
 {files:["apps/web/src/**/*.{ts,tsx}"],rules:{"no-restricted-imports":["error",{patterns:["@nestjs/*","@prisma/*","prisma","better-auth","better-auth/adapters/*","better-auth/node"]}]}},
  {
    files: ["apps/**/*.{ts,tsx}", "libs/**/*.{ts,tsx}"],
    plugins: { "@nx": nx },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          allow: [],
          depConstraints: constraints,
          enforceBuildableLibDependency: false,
        },
      ],
  
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: [
      "libs/shared/api-client/**/*.ts",
      "libs/shared/permissions/**/*.ts",
      "libs/shared/tokens/**/*.ts",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "localStorage",
        "sessionStorage",
        "process",
        "Buffer",
      ],
    },
  },
];
