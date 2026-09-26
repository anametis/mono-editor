# Application and component catalog

[Handbook](../README.md)

This catalog covers all 15 Nx projects. Libraries are imported through their `@kara/*` public entrypoints. They are not independent servers. Use [development](../development.md) for runnable targets and [boundaries](boundaries.md) for allowed imports.

## Applications

| Nx project | Entry/source                                                                                       | Responsibility                                                                                        | Key dependencies                                  |
| ---------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `admin`    | [main.tsx](../../apps/admin/src/main.tsx)                                                          | React/Vite staff workspace, TanStack Router, QueryClient, lazy editorial/account routes               | API client, auth client, UI, tokens               |
| `web`      | [app directory](../../apps/web/src/app)                                                            | Next App Router public journal, article metadata, account page, discovery routes                      | API over HTTP, browser auth client, UI, tokens    |
| `api`      | [bootstrap.ts](../../apps/api/src/bootstrap.ts), [app.module.ts](../../apps/api/src/app.module.ts) | Nest HTTP composition, auth handler, request logging, origin checks, DTO validation, health endpoints | Content, identity, interactions, platform modules |
| `worker`   | [main.ts](../../apps/worker/src/main.ts)                                                           | Headless Nest context; publish due revisions, emit metrics, write heartbeat                           | ContentService, database, observability           |

## Domain and platform libraries

| Nx project / package                                      | Source                                                             | Responsibility and contract                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-server` / `@kara/content-server`                 | [content/server](../../libs/content/server/src)                    | Exports ContentModule and ContentService. Owns public/editorial queries, DTOs, assignment, revision transitions, row locks, and scheduled publication |
| `identity-server` / `@kara/identity-server`               | [identity/server](../../libs/identity/server/src/index.ts)         | Exports IdentityModule. Owns staff access lookup, invitation issuance/acceptance, grants, and related audit events                                    |
| `interactions-server` / `@kara/interactions-server`       | [interactions/server](../../libs/interactions/server/src/index.ts) | Exports InteractionsModule. Owns authenticated reader bookmark list/save/remove; reads published content but does not modify it                       |
| `platform-database` / `@kara/platform-database`           | [database](../../libs/platform/database/src/index.ts)              | Prisma Database provider and lifecycle, DatabaseModule, Prisma exports; centralized schema and SQL migrations                                         |
| `platform-auth` / `@kara/platform-auth`                   | [auth](../../libs/platform/auth/src/index.ts)                      | Better Auth configuration and mail integration, AUTH injection token, SessionGuard, StaffGuard, request principal                                     |
| `platform-observability` / `@kara/platform-observability` | [observability](../../libs/platform/observability/src)             | Pino logger, publication metrics, optional early OpenTelemetry instrumentation                                                                        |

## Shared libraries

| Nx project / package                | Source                                                 | Responsibility and usage                                                                                                          |
| ----------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `api-client` / `@kara/api-client`   | [index.ts](../../libs/shared/api-client/src/index.ts)  | `apiClient(baseUrl = "")` creates a typed openapi-fetch client; generated `paths` and `components` types; same-origin credentials |
| `auth-client` / `@kara/auth-client` | [index.ts](../../libs/shared/auth-client/src/index.ts) | Better Auth React client at `/api/auth`, username and two-factor client plugins                                                   |
| `permissions` / `@kara/permissions` | [index.ts](../../libs/shared/permissions/src/index.ts) | Universal permission identifiers, role bundles, and Principal type; no React or Node dependencies                                 |
| `ui` / `@kara/ui`                   | [index.tsx](../../libs/shared/ui/src/index.tsx)        | Shared Button and Notice primitives; colocated Storybook stories; no network or domain logic                                      |
| `tokens` / `@kara/tokens`           | [styles.css](../../libs/shared/tokens/src/styles.css)  | Shared theme, layout, typography, form, focus, and responsive styles; used by both apps and Storybook                             |

### Shared UI contract

`Button` forwards standard React button attributes to a native `<button>`. Pass `type="button"` for non-submit controls inside forms, `disabled` for unavailable actions, and an accessible name. It does not add loading behavior or authorization.

`Notice` accepts `children` and optional `error` (default false). Normal notices use `role="status"`; errors use `role="alert"` and an error class. Keep feedback meaningful to screen reader users. Check stories and [component tests](../../tests/ui/components.spec.ts) when changing behavior or styling.

Use semantic HTML, labels, keyboard focus, and existing tokens. Share components when both applications need them; keep app-specific workflows with their feature. The shared UI layer cannot import API/auth clients.

## Frontend features and routes

| Surface                 | Source                                                                                                                                                                     | Behavior and state                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin `/`               | [Editorial](../../apps/admin/src/features/content/editorial.tsx)                                                                                                           | Fetches current access then paginated editorial posts; creates/edits drafts; submits, approves, publishes, schedules, cancels; invites/accepts staff |
| Admin draft form        | [draft-schema.ts](../../apps/admin/src/features/content/draft-schema.ts)                                                                                                   | Zod validation through React Hook Form; server DTO validation remains authoritative                                                                  |
| Admin `/account`        | [Account](../../apps/admin/src/routes/account.tsx)                                                                                                                         | Username sign-in, MFA enrollment, email/recovery code verification, sign-out                                                                         |
| Journal `/`             | [page.tsx](../../apps/web/src/app/page.tsx)                                                                                                                                | Server-rendered published summaries, 20 per page, dynamic/no-store reads                                                                             |
| Journal `/posts/[slug]` | [page.tsx](../../apps/web/src/app/posts/[slug]/page.tsx)                                                                                                                   | Published article, canonical/Open Graph/JSON-LD metadata, plain text body, SavePost control                                                          |
| Journal `/account`      | [Account](../../apps/web/src/features/account/account.tsx)                                                                                                                 | Registration, sign-in, password recovery/reset, optional MFA, bookmark list/removal                                                                  |
| Journal save control    | [SavePost](../../apps/web/src/features/interactions/save-post.tsx)                                                                                                         | Saves a published post for the verified reader, with pending and result feedback                                                                     |
| Journal HTTP access     | [data.ts](../../apps/web/src/features/content/data.ts)                                                                                                                     | Server-only client factory using `API_INTERNAL_URL`; no direct database imports                                                                      |
| Journal discovery       | [sitemap index](../../apps/web/src/app/sitemap.xml/route.ts), [sitemap pages](../../apps/web/src/app/sitemaps/[page]/route.ts), [robots](../../apps/web/src/app/robots.ts) | Publishes discovery metadata for published content                                                                                                   |
| Journal fallbacks       | [loading](../../apps/web/src/app/loading.tsx), [error](../../apps/web/src/app/error.tsx), [not found](../../apps/web/src/app/not-found.tsx)                                | Pending, failed, and missing-page states                                                                                                             |

Post assignment has an API endpoint but no assignment form in the current editorial component. Avoid describing API capabilities as completed UI features.

## Supporting tools and infrastructure

| Location                                                                                                                   | Purpose                                                                            |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [tools/compile.mjs](../../tools/compile.mjs), [build-server.mjs](../../tools/build-server.mjs)                             | Compile server/tool TypeScript into Node artifacts                                 |
| [tools/next.mjs](../../tools/next.mjs)                                                                                     | Root environment loading and Next development/build/standalone preview wrapper     |
| [tools/openapi/generate.ts](../../tools/openapi/generate.ts)                                                               | Generates OpenAPI from Nest controllers/DTOs without starting an HTTP listener     |
| [tools/bootstrap-staff.ts](../../tools/bootstrap-staff.ts)                                                                 | Guarded initial administrator bootstrap with transaction/advisory lock             |
| [tools/eslint/boundaries.mjs](../../tools/eslint/boundaries.mjs), [check-boundaries.mjs](../../tools/check-boundaries.mjs) | Dependency restrictions and project tag validation                                 |
| [tests](../../tests)                                                                                                       | Architecture assertions, service integration, application/browser and cache checks |
| [tools/load.mjs](../../tools/load.mjs), [verify-backup.mjs](../../tools/verify-backup.mjs)                                 | Authorized staging load scenarios and isolated database backup/restore check       |
| [Dockerfile](../../infra/containers/Dockerfile), [compose.yaml](../../compose.yaml), [Nginx](../../infra/nginx/nginx.conf) | Application image, process composition, routing, rate limiting, public HTML cache  |
| [CI workflow](../../.github/workflows/ci.yml)                                                                              | Verification pipeline and failure artifacts; no production deployment              |

`docs/architecture/openapi.json` and `libs/shared/api-client/src/schema.d.ts` are committed generated contracts. `dist`, `.next`, `.nx`, browser reports, and `.local` are build, cache, or local artifacts; they are not authoritative documentation or application records.
