# Operations

[Handbook](../README.md) · [Development commands](../development.md) · [Runtime state](overview.md)

## Configuration

Copy `.env.example` and configure:

- `DATABASE_URL`: PostgreSQL application connection with least privilege. Keep migrations under a separate deployment identity when operating production.
- `BETTER_AUTH_SECRET`: cryptographically random value, at least 32 characters. Never rotate casually; follow the authentication provider's session/key rotation procedure.
- `AUTH_URL`: public HTTPS authentication URL ending in `/api/auth`.
- `TRUSTED_ORIGINS`: comma-separated exact HTTPS journal/admin origins. Production startup rejects HTTP origins.
- `WEB_URL`, `ADMIN_URL`: public frontend origins.
- `API_INTERNAL_URL`: private Nest origin, normally `http://api:4000` in Compose.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`: authenticated mail delivery. Use port 465 with SMTP_SECURE=true or your provider's STARTTLS configuration. Never disable TLS certificate verification.
- `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`: optional OTLP collector and distinct api/worker service name.

Applications fail closed if required configuration is absent. Browser code never reads server secrets. API request logs redact authorization/cookies and omit bodies and query strings.

Additional runtime settings are `PORT` (API, default 4000), `WORKER_HEARTBEAT` (worker heartbeat file, default `/tmp/kara-worker-heartbeat`), and `LOG_LEVEL` (Pino, default `info`). If you change the heartbeat path or API port, also update health probes and routing. The local Next wrapper fixes its preview port at 3000. Admin's local API proxy is fixed at localhost:4000.

Root `.env` is loaded explicitly by API/worker development commands and the Next wrapper; Compose injects it into containers. Do not assume every raw framework command loads that file. The API requires database and authentication/mail configuration. Worker application startup uses the database; its Nx build still has API contract-generation prerequisites.

## Build and launch

```sh
pnpm build
# Apply reviewed migrations once, before the new app version receives traffic.
pnpm db:migrate
docker compose build
docker compose up -d
```

Compose expects an independently operated PostgreSQL service and SMTP. The proxy binds loopback ports 8080 (journal) and 8081 (admin). Put a TLS ingress in front of these on separate hostnames; do not expose these HTTP ports directly. API and web containers have no published ports. The trusted ingress must replace forwarded client IP headers, not append arbitrary client-provided values. Restrict direct API access to the private network.

The admin static bundle is mounted from `dist/apps/admin`; build it before launching. The application image contains the workspace runtime and build dependencies for reproducibility. Optimize into smaller per-app runtime images if image size becomes an operational problem; this does not change library ownership.

Configure Nginx's `set_real_ip_from` with the actual TLS ingress address/CIDR and `real_ip_header X-Forwarded-For` before launch, so rate limiting uses visitor addresses. Never trust all addresses (`0.0.0.0/0`). The ingress must replace this header. Nest trusts exactly the adjacent private proxy, which replaces it again. Public content reads bypass Nest's per-client limiter because server rendering shares an internal source address; authentication and private endpoints retain their limits.

Health: `/health/live` confirms process liveness; `/health/ready` queries PostgreSQL. The worker writes a heartbeat only after a successful polling cycle. Compose checks its age. Add your alert destination before release: API readiness failures, worker heartbeat older than 60 seconds, OTP delivery errors, database saturation, and publication lag approaching three minutes.

## Cache policy

Only `/` and `/posts/<slug>` full HTML GET responses are allowlisted. Cache entries expire after 60 seconds. Next dynamic routes and fetches have caching disabled. Cookie, authorization, query-string, RSC, prefetch, and router-state requests bypass the proxy cache. Responses with Set-Cookie, non-HTML content, non-200 status, or Vary:* are not reusable. Error and private routes never enter this cache.

The proxy overrides Next's Cache-Control only on the explicit public route allowlist and sends `private, no-store` to browsers. It preserves upstream Vary handling. Do not add another CDN/page cache without re-budgeting freshness. Expired entries are not served during origin failure: visitors see an error instead of silently outdated content.

The worker polls at 15-second intervals without overlap, in batches of 100. Backlog and database latency add to that interval; monitor and load test them. Three-minute visibility is a healthy-operation objective, not an outage guarantee or a promise to refresh already-open tabs.

## Database recovery and migrations

Commit every SQL migration, inspect it, test it on an isolated restored database, and apply it once per release. Never use schema push in production. Prefer additive schema changes that both old and new app versions can read; remove old fields in a later release.

Back up PostgreSQL off-host with encrypted retention and a provider-appropriate WAL/PITR strategy. Test restoration on a separate host. `tools/verify-backup.mjs` demonstrates a dump/restore check exclusively for `kara_test`; it does not configure production retention or continuous recovery.

## Capacity and performance

Use an authorized staging deployment:

```sh
LOAD_ORIGIN=https://staging.example.com LOAD_CONCURRENCY=20 LOAD_REQUESTS=1000 node tools/load.mjs
```

Provide `LOAD_COOKIE` for a disposable test account to include authenticated traffic. This is secret input; never log it. The script separates public cache hits, uncached rendering, and authenticated reads and reports errors and p95 latency. Increase load gradually against measured peak traffic, not daily user count.

Field targets: p75 LCP <=2.5s, INP <=200ms, CLS <=0.1. Lab/browser checks do not establish these field percentiles. Configure field monitoring and real alert destinations before public launch. No external fonts, trackers, or image uploads are included in this slice.

## Observability and incident diagnosis

Compose loads the API and worker instrumentation entrypoints before application code. OTLP export requires `OTEL_EXPORTER_OTLP_ENDPOINT`; merely setting that variable on the ordinary local `dev:api` or `dev:worker` command does not preload instrumentation. For local telemetry diagnosis, build the app and launch it with the instrumentation module:

```sh
node --env-file=.env --import ./dist/apps/api/instrumentation.mjs dist/apps/api/main.mjs
```

Use the corresponding worker paths to instrument the worker. Give each process an appropriate `OTEL_SERVICE_NAME`. Metrics include `kara.publications`, `kara.worker.duration` (ms), `kara.worker.failures`, and `kara.publication.lag` (seconds). Request logs contain generated request IDs and sanitized request details; no response correlation header is explicitly configured.

Initial read-only diagnosis:

```sh
docker compose ps
docker compose logs --tail=100 api worker web proxy
docker compose exec api node -e "fetch('http://localhost:4000/health/ready').then(async r => console.log(r.status, await r.text()))"
```

Treat log output as sensitive operational data. Do not paste cookies, secrets, invitation links, or private content into public incident reports.

| Symptom                       | Diagnose                                                                                          | Recovery and verification                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| API not ready                 | Check database reachability, connection budget, credentials, migration status, API logs           | Restore dependency availability; confirm readiness and representative public/private requests                       |
| Scheduled publication delayed | Check worker process/heartbeat, overdue lag, clock, database locks and worker errors              | Restore worker/database health; confirm due revisions progress and lag falls; avoid manual state edits              |
| Repeated worker failures      | Inspect the failing transaction and constraint/error details                                      | Fix the underlying data/code issue through a reviewed change; worker retries discovery automatically                |
| Public page appears old       | Inspect `X-Cache`, request type/cookies, 60 second TTL, worker lag, and current published pointer | Verify via an uncached request and then a new public HTML request; do not add another cache layer                   |
| OTP/reset mail unavailable    | Check SMTP connectivity, credentials, provider errors, and rate limits                            | Restore mail delivery; request a fresh code or use a previously saved recovery code; never disable MFA to bypass it |
| Editorial forbidden           | Check email verification, Staff permissions, current MFA enablement and session verification      | Complete the intended access flow; recheck a privileged request                                                     |
| Proxy 502                     | Check API/web process health and private routing                                                  | Restore origin; verify both public and private routes; expired HTML is deliberately not served                      |

An unhealthy Compose container is a signal, not a configured remediation workflow. `restart: unless-stopped` restarts exited processes; it does not automatically repair a running process solely because its healthcheck fails. Supply monitoring and an operational response outside Compose.

## Release, rollback, and recovery

Before release, record the source revision, image identity, migration set, environment changes, operator, and validation evidence. The repository's CI verifies code; it does not publish or deploy a release. Run integration/browser/backup checks only with the isolated `kara_test` database, never against production.

1. Review the migration and compatibility with the currently running version. Back up the database according to the deployment's recovery policy and verify that a recent restore drill exists.
2. Produce and retain reproducible application artifacts from the reviewed revision. Keep admin assets and the API/web/worker artifacts from the same compatible release.
3. Apply reviewed migrations once through the deployment identity before new traffic reaches code that requires them. Use compatible additive changes for mixed-version rollouts.
4. Launch the release, then check API readiness, worker heartbeat and lag, public rendering, staff MFA, a controlled publication flow, and private cache isolation.
5. Observe error rates and latency against the deployment's agreed thresholds before declaring completion.

If a release is faulty, restore the prior application artifacts only when they remain compatible with the deployed schema. Retain the previous image and admin bundle for this purpose; the supplied Compose file does not implement release version selection or automatic rollback. Do not delete applied migrations or assume Prisma supplies a safe reverse migration. Use a reviewed forward correction where possible.

For data recovery, restore backups/PITR into an isolated database first, validate schema and application invariants, assess the data loss window, and coordinate a controlled cutover. Do not restore over the only live copy as a diagnostic experiment. Record the achieved recovery time and data loss, and reconcile writes around the cutover. RPO, RTO, backup retention, encryption/key access, and failover ownership must be defined by the deployment operator; they are not configured here.

## Production readiness boundaries

Before exposing the service, supply named release/incident owners, TLS and hostname configuration, trusted proxy addresses, database/SMTP services, secret management, alert destinations, capacity measurements, retention policies, and tested recovery procedures. Review security and accessibility requirements against the intended audience. No production deployment, high availability guarantee, tenant isolation, autoscaling policy, or compliance certification is supplied by these application manifests.
