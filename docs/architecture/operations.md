# Operations

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
