import { compile } from "./compile.mjs";
const app = process.argv[2];
if (!["api", "worker"].includes(app)) throw new Error("Expected api or worker");
await compile(`apps/${app}/src/main.ts`, `dist/apps/${app}/main.mjs`);
await compile(
  "libs/platform/observability/src/instrumentation.ts",
  `dist/apps/${app}/instrumentation.mjs`,
);
