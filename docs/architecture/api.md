# API contract and integration guide

[Handbook](../README.md)

The Nest API uses `/api` for domain routes. Health routes are outside that prefix. Browser callers use the frontend's `/api` proxy and session cookies; server-side public reads use `API_INTERNAL_URL`. A standalone HTTP client must supply an appropriate session cookie and trusted Origin for mutations.

The generated [OpenAPI document](openapi.json) is the schema reference for Nest controller routes, and [schema.d.ts](../../libs/shared/api-client/src/schema.d.ts) provides client types. Better Auth is mounted directly as a Node handler at `/api/auth`; its routes and the directly registered health routes are not comprehensively described by this Nest-generated contract. No Swagger UI route is configured.

## Route families

| Method  | Path                                    | Access / purpose                                                   |
| ------- | --------------------------------------- | ------------------------------------------------------------------ |
| GET     | `/health/live`                          | Process liveness                                                   |
| GET     | `/health/ready`                         | Database readiness; 503 when its query fails                       |
| GET     | `/api/posts?page=1`                     | Public summaries for currently published posts                     |
| GET     | `/api/posts/:slug`                      | Current published article; 404 if unavailable                      |
| GET     | `/api/discovery/count`                  | Published post count for sitemap generation                        |
| GET     | `/api/discovery/entries?page=1`         | Published sitemap entries                                          |
| GET     | `/api/editorial/posts?page=1`           | Staff editorial queue filtered by permissions/ownership            |
| POST    | `/api/editorial/posts`                  | Creator creates post and initial draft                             |
| PATCH   | `/api/editorial/posts/:id/assignment`   | `post:assign`; target must have `post:create`                      |
| PATCH   | `/api/editorial/revisions/:id`          | Owned/assigned creator edits with current version                  |
| POST    | `/api/editorial/revisions/:id/submit`   | Creator submits owned/assigned draft                               |
| POST    | `/api/editorial/revisions/:id/approve`  | Different reviewer approves submitted revision                     |
| POST    | `/api/editorial/revisions/:id/publish`  | Publisher immediately publishes approved revision                  |
| POST    | `/api/editorial/revisions/:id/schedule` | Publisher schedules approved revision                              |
| POST    | `/api/editorial/revisions/:id/cancel`   | Publisher cancels schedule back to approved                        |
| GET     | `/api/identity/access`                  | Current verified staff principal and permissions                   |
| POST    | `/api/identity/invitations`             | `staff:manage`; issues invitation link                             |
| POST    | `/api/identity/invitations/accept`      | Verified signed-in invited email owner; staff MFA not yet required |
| GET     | `/api/bookmarks?page=1`                 | Verified reader's saved published posts                            |
| PUT     | `/api/bookmarks/:postId`                | Verified reader saves published post idempotently                  |
| DELETE  | `/api/bookmarks/:postId`                | Verified reader removes own bookmark idempotently                  |
| Various | `/api/auth/*`                           | Better Auth account, session, verification, reset, and MFA flows   |

All editorial endpoints use StaffGuard; domain checks still decide which actions that staff member can perform. Hiding buttons does not grant access. There is no generic bearer-token integration API configured.

## Use the client

```ts
import { apiClient } from "@kara/api-client";

const api = apiClient(); // Browser: same origin and its cookies.
const { data, error, response } = await api.GET("/api/posts", {
  params: { query: { page: 1 } },
});
if (error) throw new Error(`Content request failed: ${response.status}`);
```

Transport failures can throw; callers need to handle those separately from an HTTP error response. In Next server code, use the existing `publicApi()` factory with `cache: "no-store"`. Do not forward browser cookies into public rendering or introduce a second shared cache without reviewing isolation and freshness.

Read-only local checks:

```sh
curl --fail http://localhost:4000/health/ready
curl --fail 'http://localhost:4000/api/posts?page=1'
```

Mutation payload examples (authentication and exact trusted Origin are also required):

```json
{
  "slug": "first-story",
  "title": "First story",
  "summary": "A short summary",
  "body": "Plain text article."
}
```

```json
{
  "title": "Updated title",
  "summary": "Updated summary",
  "body": "Updated text.",
  "version": 1
}
```

The first payload creates a post; the second edits a revision. A schedule payload has the form `{ "scheduledAt": "2030-01-01T12:00:00Z" }`; replace the example with an intended future instant. There are no general idempotency keys for post creation or transitions. Do not blindly replay an uncertain write; inspect the current revision state first.

## Validation and errors

Request DTOs reject unknown fields. Titles allow 1–160 characters, summaries 1–320, bodies 1–100,000, and slugs 1–120 lowercase alphanumeric characters separated by single hyphens. The JSON parser also caps the entire encoded body at 128 KB, so a character-valid request can still exceed the transport byte limit. Edit versions are positive integers. See [DTO source](../../libs/content/server/src/http/dto.ts).

| Status | Typical interpretation                                                         | Client action                                                     |
| ------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 400    | Invalid payload, schedule time, assignment, or invitation                      | Correct the input; show actionable feedback                       |
| 401    | Missing/invalid session or unverified email                                    | Sign in and complete email verification                           |
| 403    | Untrusted origin, staff/MFA requirement, ownership, or permission denial       | Check the specific access prerequisite; do not retry in a loop    |
| 404    | Requested revision or public content does not exist/is not published           | Show a missing-resource state                                     |
| 409    | Slug conflict, stale version, existing working revision, or invalid transition | Reload and reconcile state                                        |
| 413    | Encoded request exceeds parser size                                            | Reduce request payload                                            |
| 429    | Rate limiter rejected traffic                                                  | Reduce request frequency and honor retry guidance when supplied   |
| 5xx    | Server/dependency failure                                                      | Preserve user input and diagnose before retrying uncertain writes |

Errors are framework/provider responses, not a universal custom error envelope. OpenAPI response coverage is not exhaustive. Clients should handle errors explicitly rather than assuming a success DTO on every response.

## Change the contract

1. Update the owning controller/DTO and domain behavior, preserving boundary rules.
2. Run `pnpm nx run api-client:generate` (or `pnpm contracts`) with configured root environment.
3. Review and commit both `docs/architecture/openapi.json` and `libs/shared/api-client/src/schema.d.ts`.
4. Update callers and this guide for route or behavior changes; run types, lint, and relevant tests.

CI regenerates the contract and rejects drift. The document's version `1` is metadata; there is no `/v1` route prefix or automated compatibility/versioning policy. Coordinate breaking client/server changes or use a backwards-compatible rollout.
