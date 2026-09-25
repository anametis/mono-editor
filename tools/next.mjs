import { cpSync, existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
if (process.argv[2] === "start") {
  // Next's standalone output omits static/public assets; prepare the local preview.
  const output = "apps/web/.next/standalone/apps/web";
  cpSync("apps/web/.next/static", `${output}/.next/static`, {
    recursive: true,
  });
  if (existsSync("apps/web/public"))
    cpSync("apps/web/public", `${output}/public`, { recursive: true });
  process.env.HOSTNAME = "127.0.0.1";
  process.env.PORT = "3000";
  await import("../apps/web/.next/standalone/apps/web/server.js");
} else {
  process.argv = [
    process.argv[0],
    "next",
    process.argv[2] ?? "dev",
    "apps/web",
    "--webpack",
    ...(process.argv[2] === "dev" ? ["--port", "3000"] : []),
  ];
  await import("next/dist/bin/next");
}
