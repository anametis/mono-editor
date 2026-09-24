import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
process.argv = [
  process.argv[0],
  "next",
  process.argv[2] ?? "dev",
  "apps/web",
  "--webpack",
  ...(process.argv[2] === "dev" ? ["--port", "3000"] : []),
];
await import("next/dist/bin/next");
