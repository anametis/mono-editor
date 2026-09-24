import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
process.loadEnvFile(".env");
const url = new URL(process.env.DATABASE_URL);
if (url.pathname !== "/kara_test")
  throw new Error("Backup verification requires isolated kara_test");
const target = new URL(url);
target.pathname = `kara_restore_${process.pid}`;
const dump = ".local/restore-test.dump";
await mkdir(".local", { recursive: true });
const run = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
let created = false;
try {
  run("pg_dump", ["--dbname", url.href, "--format=custom", "--file", dump]);
  run("createdb", ["--maintenance-db", url.href, target.pathname.slice(1)]);
  created = true;
  run("pg_restore", [
    "--dbname",
    target.href,
    "--exit-on-error",
    "--no-owner",
    dump,
  ]);
  const query =
    "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'";
  if (
    run("psql", [url.href, "-Atc", query]) !==
    run("psql", [target.href, "-Atc", query])
  )
    throw new Error("Restored schema differs");
  console.log("PASS backup and restore into an isolated database");
} finally {
  if (created)
    run("dropdb", ["--maintenance-db", url.href, target.pathname.slice(1)]);
  await rm(dump, { force: true });
}
