# Kara

Nx publishing workspace: React editorial app, Next.js public journal, NestJS API, PostgreSQL publication worker.

## Run locally

Requires Node 22.12+, pnpm 10, PostgreSQL, and an SMTP development inbox (for example Mailpit on port 1025). PostgreSQL and SMTP are external services; application Compose does not own production data.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Set DATABASE_URL, a random BETTER_AUTH_SECRET, SMTP settings, and application URLs.
pnpm db:generate
pnpm db:migrate
pnpm contracts
```

Run in separate terminals:

```sh
pnpm nx serve api
pnpm nx serve worker
pnpm nx serve admin
pnpm nx serve web
```

Admin: http://localhost:4200. Journal: http://localhost:3000. API readiness: http://localhost:4000/health/ready.

Register on the journal and verify your email. Bootstrap the first administrator once:

```sh
pnpm bootstrap:staff verified-email@example.com
```

Sign in on the admin app, enable email verification codes, save recovery codes, and verify the emailed code. Use the administrator's invitation form to grant other staff access. Invitation links are single use, expire after 48 hours, and must be accepted by the verified email owner. They are shown only to the inviting administrator for private delivery.

Creators can edit owned or assigned posts. A different reviewer approves each revision. Publishers publish immediately or schedule a future UTC instant. Editing reviewed content clears approval; editing published content creates a new draft and leaves the live version intact. Public bodies are plain text, never executable HTML.

## Verify

Shared component stories and browser-testing conventions are documented in [testing](docs/architecture/testing.md). Run `pnpm nx run ui:storybook` to browse the shared UI, or `pnpm nx run ui:test-storybook` to build it and test its stories with Playwright.

```sh
pnpm typecheck
pnpm lint
pnpm nx run-many -t test -p content-server admin
pnpm nx run api:integration
pnpm nx run-many -t build -p api worker admin web --parallel=2
pnpm exec playwright install chromium
pnpm nx run admin:e2e
pnpm test:cache
node tools/verify-backup.mjs
```

Integration, browser, and backup checks require `DATABASE_URL` pointing to an isolated database named `kara_test`. Browser tests use an in-process SMTP server on port 1025; integration tests use 1026. Stop your development inbox before browser tests. Use `PLAYWRIGHT_CHANNEL=chrome` to use an installed Google Chrome instead of downloading Chromium. Cache checks require Docker; `NGINX_IMAGE` can select a locally available compatible Nginx image.

The API/client contract is committed. Regenerate with `pnpm contracts`; CI rejects drift. Nx enforces library imports; `pnpm lint` also verifies all project tags.

## Deployment

See [operations](docs/architecture/operations.md), [boundaries](docs/architecture/boundaries.md), and [verification evidence](docs/architecture/verification.md).

This implements the first publishing slice, not a capacity certification for 100,000 daily users. Run the included load scenarios against your intended infrastructure before selecting instance sizes. No production service has been deployed.
