# Development and project commands

[Handbook](README.md)

Run the commands below from the repository root. Nx selects projects by names such as `admin`, not by package names such as `@kara/admin` or directory paths.

## First setup

Use Node.js 22.12 or newer and the pinned pnpm 10.6.5 from [package.json](../package.json). CI uses Node 22. You also need a reachable PostgreSQL database and an SMTP development inbox for account verification, password recovery, and staff codes. CI uses PostgreSQL 17. Docker is needed for container deployment and cache tests, not for ordinary frontend development.

```sh
pnpm install --frozen-lockfile
# On a fresh checkout only; keep an existing .env intact.
cp .env.example .env
```

Edit `.env` using [.env.example](../.env.example): set your database URL, a random authentication secret of at least 32 characters, SMTP details, and the local application URLs. Do not commit `.env`. `openssl rand -hex 32` can generate a local secret. Start PostgreSQL and your SMTP inbox separately; [compose.yaml](../compose.yaml) does not create them.

```sh
pnpm nx run platform-database:generate
pnpm nx run platform-database:migrate
pnpm nx run api-client:generate
```

The equivalent root scripts are `pnpm db:generate`, `pnpm db:migrate`, and `pnpm contracts`. Migration deploy applies committed migrations; it does not create a new migration. Contract generation constructs the API application and needs its authentication/SMTP configuration. It does not launch an HTTP listener; do not treat it as an isolated frontend task.

## Run exactly one project

Choose one command, not the entire block:

```sh
pnpm nx serve admin
pnpm nx serve web
pnpm nx serve api
pnpm nx serve worker
```

`pnpm nx serve admin` is shorthand for `pnpm nx run admin:serve`. It starts only the admin development server. Nx does not automatically start the API, worker, database, or mail service for these serve targets.

| Project  | Address                        | Runtime dependencies                                                        | Edit behavior                                          |
| -------- | ------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `admin`  | http://localhost:4200          | API for sign-in and editorial data; PostgreSQL and SMTP through API         | Vite updates the frontend during development           |
| `web`    | http://localhost:3000          | API for public content and account actions; PostgreSQL and SMTP through API | Next development server updates pages                  |
| `api`    | http://localhost:4000          | PostgreSQL; configured SMTP for mail actions                                | Builds once, starts Node; stop and rerun after changes |
| `worker` | No HTTP listener               | PostgreSQL with migrations applied                                          | Builds once, starts Node; stop and rerun after changes |
| `ui`     | Normally http://localhost:6006 | No API, database, or SMTP                                                   | Use `pnpm nx run ui:storybook`                         |

Starting a frontend alone is useful for layout work, but live data and authentication still require an API. There is no mock API mode configured. For completely isolated shared component work, use Storybook.

The admin Vite proxy forwards `/api` to `http://localhost:4000`, currently fixed in [vite.config.ts](../apps/admin/vite.config.ts). The web app uses `API_INTERNAL_URL` for its server requests and API rewrites. Browser clients call their own origin, not a separately configured browser API host.

### Start only the services your task needs

| Task                                              | Application processes to run    |
| ------------------------------------------------- | ------------------------------- |
| Shared Button/Notice styling                      | `ui:storybook` only             |
| Read already published stories                    | `api`, `web`                    |
| Edit/review/publish immediately as existing staff | `api`, `admin`                  |
| Exercise scheduled publishing in editorial        | `api`, `admin`, `worker`        |
| Verify the full reader and editorial journey      | `api`, `admin`, `web`, `worker` |

For example, start these in two separate terminals to work on editorial:

```sh
# Terminal 1
pnpm nx serve api
# Terminal 2
pnpm nx serve admin
```

Keep PostgreSQL available and SMTP running for mail flows. Start `web` too if you need to register an account through the journal. Stop an application with Ctrl+C. The worker finishes its current cycle before shutting down.

## Discover and select targets

```sh
pnpm nx show projects
pnpm nx show project admin --json
pnpm nx show projects --withTarget test
pnpm nx graph

# One project's build or lint
pnpm nx run admin:build
pnpm nx run admin:lint

# Only these two projects
pnpm nx run-many -t build -p admin web --parallel=2

# Projects affected by committed changes relative to main
pnpm nx affected -t build --base=main --head=HEAD
```

The affected command requires the base ref to exist locally and includes dependent projects. With explicit `--head=HEAD`, it compares committed revisions; it is not a check of your uncommitted edits. An unfiltered `run-many` selects all projects with that target. Use `run <project>:<target>` when you want one project.

**A selected target can have prerequisite tasks.** All four application builds depend on `api-client:generate`, which depends on `api:openapi`. Therefore a build of `admin` can run API contract generation without building or serving every application. This is task dependency execution, not a full application startup.

| Need                             | Command                                  | Scope and caveat                                                        |
| -------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| Admin form checks                | `pnpm nx run admin:test`                 | Current root Vitest configuration selects admin tests                   |
| Content policy checks            | `pnpm nx run content-server:test`        | Delegates to the current root Jest suite                                |
| Shared component browser checks  | `pnpm nx run ui:test-storybook`          | Builds Storybook first; no backend services                             |
| API integration                  | `pnpm nx run api:integration`            | Uses isolated `kara_test` database and test SMTP                        |
| Full application browser journey | `pnpm nx run admin:e2e`                  | Tests both frontends and API, despite the target name; build apps first |
| Workspace TypeScript             | `pnpm typecheck`                         | Global script; no per-project typecheck target configured               |
| Required workspace lint          | `pnpm lint`                              | Tags, Nx graph, ESLint, architecture assertions                         |
| Database client                  | `pnpm nx run platform-database:generate` | Regenerates Prisma client after schema changes                          |
| API client                       | `pnpm nx run api-client:generate`        | Regenerates committed OpenAPI and TypeScript contract                   |

Not every project has `test`, `serve`, or `build`. Inspect resolved targets rather than inventing a command. The unit targets currently delegate to root runner configurations; selecting the project is not a promise that future root test patterns stay limited to that directory.

## Build outputs and local preview

| Project              | Build output                                          |
| -------------------- | ----------------------------------------------------- |
| `api`                | `dist/apps/api/main.mjs` and `instrumentation.mjs`    |
| `worker`             | `dist/apps/worker/main.mjs` and `instrumentation.mjs` |
| `admin`              | `dist/apps/admin`                                     |
| `web`                | `apps/web/.next`, including standalone output         |
| `ui:build-storybook` | `dist/storybook/ui`                                   |

`pnpm build` regenerates contracts and builds all applications. `pnpm build:offline` builds all four using the existing contract; it does not mean the application works without its runtime services. Nx build targets are preferable for normal project selection and task caching.

After `pnpm nx run web:build`, `node tools/next.mjs start` starts a local standalone preview on port 3000 and loads the root `.env`. It also copies Next static/public assets into standalone output. The inferred `web:start` target runs `next start` and has a build prerequisite; do not assume it follows this wrapper's root environment loading behavior. Production deployment is covered in [operations](architecture/operations.md).

## First staff account

1. Run API and web, register on `/account`, and verify the email through your development inbox.
2. Run `pnpm bootstrap:staff verified-email@example.com` with the exact registered email. This works only when no staff member exists.
3. Start admin, sign in on `/account`, enable email verification codes, save the recovery codes privately, and complete the email challenge.
4. Use editorial's invitation form for additional staff. Deliver the returned private link to the invited email owner. It expires after 48 hours and is single use.

Publishing requires a different reviewer from the post's owner or assigned creator. Even an administrator cannot approve their own post. See [security](architecture/security.md) for the role table.

## Daily contribution workflow

Keep changes within the [ownership boundaries](architecture/boundaries.md). Update controllers and DTOs before regenerating an API contract; commit both generated artifacts. For schema changes, create and review a SQL migration on a development database, include SQL-only invariants, and test an upgrade on an isolated database before deployment.

Run the relevant focused tests, then `pnpm typecheck` and `pnpm lint`. Per-project lint does not replace the repository's required global lint. See [testing](architecture/testing.md) for integration/browser prerequisites. Update affected documentation in the same change. CI verifies contracts, types, boundaries, policy/form tests, integration, builds, browser journeys, and cache isolation; it does not deploy.

## Troubleshooting

| Symptom                                         | Check or action                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Unknown Nx project or target                    | Use `pnpm nx show projects` and `pnpm nx show project <name> --json`                                  |
| API/worker edits do not appear                  | Stop and rerun their serve command; they are not watch processes                                      |
| Frontend API proxy fails                        | Start API, check `/health/ready`, then check proxy host and port                                      |
| Missing environment variable during build       | Contract generation loads API configuration; configure root `.env` even for an Nx frontend build      |
| Prisma client or table missing                  | Run database generation, then apply committed migrations to the intended local database               |
| Mutation returns `403 Untrusted origin`         | Send an exact allowlisted `Origin`; keep local ports and `TRUSTED_ORIGINS` consistent                 |
| Staff login succeeds but editorial is forbidden | Verify email, staff grant, current MFA enablement, and current session's OTP/recovery verification    |
| Approval rejected                               | The reviewer cannot be the owner or assignee; the revision must be submitted                          |
| Revision edit returns `409`                     | Reload the latest version and reconcile your edits before retrying                                    |
| Scheduled post stays hidden                     | Start worker; inspect due time, logs, heartbeat, and publication lag; see operations                  |
| Mail/test port busy                             | Stop the development inbox before e2e; e2e owns 1025, integration uses 1026                           |
| Browser binary missing                          | Run `pnpm exec playwright install chromium`, or use `PLAYWRIGHT_CHANNEL=chrome` with installed Chrome |
| Nx graph or cached task appears stale           | Try `pnpm nx reset`; rerun a task with `--skipNxCache` to diagnose, not as a permanent workaround     |

Do not delete your database or migration history to resolve a tooling cache problem. Development cookies on `localhost` are shared across ports; separate browser contexts can help test distinct accounts. Production uses separate hostnames.
