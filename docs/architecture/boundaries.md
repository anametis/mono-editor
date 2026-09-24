# Ownership and dependencies

Apps compose routes and modules. `content/server` owns revision transitions and publication; `identity/server` owns staff permissions/invitations; `interactions/server` owns private bookmarks. Platform libraries own database connections, authentication integration, and telemetry. Shared libraries contain frontend clients, permission identifiers, UI, and CSS tokens.

Prisma schema/migrations are centralized. Query ownership remains in each domain. The interactions domain may read published post identifiers/titles when saving or displaying bookmarks, but it cannot modify content. No frontend, including Next Server Components, imports server libraries.

Every project has exactly one scope, type, and runtime tag. Rules are in `tools/eslint/boundaries.mjs`. UI can depend on utility/UI projects, not network clients. Universal code cannot import React, Node, authentication, or platform packages. Imports use public entrypoints. Explicit workspace dependencies are linked by pnpm; TypeScript aliases also allow the server bundler to compile internal source into deployable artifacts.

No generic repositories or event bus. A post row lock serializes changes to that post across API and workers. Reviewer approval belongs to the exact revision. Scheduled work is persisted as a revision state, not an in-memory timer. The worker's timer only discovers due database rows.

Permission role defaults: creator, reviewer, publisher, administrator. Role definitions are convenience bundles; authorization checks individual permissions and ownership. Staff grants come from invitations or the one-time bootstrap command. Session cookies are host-only. Use distinct hostnames in production, not just different ports: cookies are not port isolated.

The auth integration uses Better Auth's Node handler directly with Nest, avoiding an additional community wrapper. The same identity store supports separate sessions on each frontend origin. A custom non-input session flag is marked only after successful OTP or recovery-code verification; staff guards also check current MFA enablement and permissions in PostgreSQL.

Bodies are plain text in this slice. Add a deliberately sanitized rich-text format before accepting authored HTML. Phone/SMS, comments, notifications, upload processing, and multi-tenancy are not implemented.

Add new domains only when they have business ownership. Add independent services only when measured deployment, scaling, or isolation needs justify them. Keep app-specific features in their app until there is actual reuse or an ownership boundary to enforce.
