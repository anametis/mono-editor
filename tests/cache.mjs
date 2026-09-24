import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import assert from "node:assert/strict";
await mkdir(".local", { recursive: true });
const config = resolve(".local/cache-nginx.conf");
await writeFile(
  config,
  (await readFile("infra/nginx/nginx.conf", "utf8"))
    .replace("server api:4000", "server host.docker.internal:4401")
    .replace("server web:3000", "server host.docker.internal:4401"),
);
let sequence = 0;
const server = createServer((req, res) => {
  sequence++;
  res.setHeader(
    "Cache-Control",
    "private, no-cache, no-store, max-age=0, must-revalidate",
  );
  res.setHeader(
    "Vary",
    "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Url",
  );
  res.setHeader(
    "Content-Type",
    req.headers.rsc ? "text/x-component" : "text/html",
  );
  if (req.url === "/posts/cookie")
    res.setHeader("Set-Cookie", "test=private; HttpOnly");
  if (req.url === "/posts/error") res.statusCode = 500;
  res.end(`${req.headers.cookie ?? "public"}:${sequence}`);
});
await new Promise((resolve) => server.listen(4401, "0.0.0.0", resolve));
const name = `kara-cache-${process.pid}`;
const request = (path = "/", headers = {}) =>
  fetch(`http://127.0.0.1:4280${path}`, {
    headers: { accept: "text/html", ...headers },
  });
try {
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "-d",
      "--name",
      name,
      "--add-host",
      "host.docker.internal:host-gateway",
      "-p",
      "127.0.0.1:4280:8080",
      "-v",
      `${config}:/etc/nginx/nginx.conf:ro`,
      process.env.NGINX_IMAGE ?? "nginx:1.28-alpine",
    ],
    { stdio: "pipe" },
  );
  let ready = false;
  for (let n = 0; n < 50; n++) {
    try {
      await request("/health");
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert(ready, "Nginx started");
  const first = await request();
  assert.equal(first.headers.get("x-cache"), "MISS");
  const firstBody = await first.text();
  const hit = await request();
  assert.equal(hit.headers.get("x-cache"), "HIT");
  assert.equal(await hit.text(), firstBody);
  for (const headers of [
    { cookie: "session=private" },
    { authorization: "Bearer private" },
    { rsc: "1" },
    { "next-router-state-tree": "test" },
    { "next-router-prefetch": "1" },
    { "next-url": "/account" },
  ]) {
    const response = await request("/", headers);
    assert.equal(
      response.headers.get("x-cache"),
      "BYPASS",
      JSON.stringify(headers),
    );
  }
  for (const path of ["/posts/cookie", "/posts/error"]) {
    await request(path);
    assert.notEqual((await request(path)).headers.get("x-cache"), "HIT", path);
  }
  assert.notEqual((await request("/?preview=1")).headers.get("x-cache"), "HIT");
  assert.equal(
    (await request()).headers.get("x-cache"),
    "HIT",
    "Private requests did not poison public cache",
  );
  console.log(
    "PASS cache isolation: cookies, auth, RSC, navigation, errors, Set-Cookie, query strings",
  );
  await new Promise((r) => setTimeout(r, 61000));
  await new Promise((resolve) => server.close(resolve));
  const unavailable = await request();
  assert.equal(
    unavailable.status,
    502,
    "Never serve expired content when origin fails",
  );
  console.log(
    "PASS hard expiry: stale HTML is not served during upstream failure",
  );
} finally {
  server.close();
  try {
    execFileSync("docker", ["rm", "-f", name], { stdio: "ignore" });
  } catch {}
  await rm(config, { force: true });
}
