module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/libs/**/*.spec.ts"],
  modulePathIgnorePatterns:["<rootDir>/apps/web/.next/","<rootDir>/dist/"],
  moduleNameMapper: {
    "^@kara/platform-database$":
      "<rootDir>/libs/platform/database/src/index.ts",
    "^@kara/permissions$": "<rootDir>/libs/shared/permissions/src/index.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          target: "ES2022",
          module: "CommonJS",
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          strict: true,
        },
      },
    ],
  },
};
