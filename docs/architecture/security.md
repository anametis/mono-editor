# Identity, permissions, and trust boundaries

[Handbook](../README.md)

This page records implemented controls and their limits. It is not a security certification. Source: [platform auth](../../libs/platform/auth/src/index.ts), [API bootstrap](../../apps/api/src/bootstrap.ts), [identity](../../libs/identity/server/src/index.ts), and [permissions](../../libs/shared/permissions/src/index.ts).

## Authentication and staff access

Better Auth owns account/password, verification, session, recovery, and two-factor flows. Email/password accounts require verified email and passwords of at least 12 characters. Sessions expire after seven days; cookie session caching is disabled. Production cookies are HttpOnly, Secure, SameSite=Lax, and host-only.

SessionGuard requires a valid session with verified email. StaffGuard additionally loads current Staff permissions and stored session/user state on every privileged request. Both `Session.mfaVerified` and current `User.twoFactorEnabled` must be true. The MFA session flag is not accepted from client input; the server marks it after a successful email OTP or recovery-code verification. An email code expires after three minutes.

Email-based MFA is the implemented staff flow. It is not a claim of phishing-resistant authentication or enterprise SSO. Assess stronger factors and identity-provider requirements before a deployment that requires them.

## Default permission bundles

| Role          | Permissions                                                                   |
| ------------- | ----------------------------------------------------------------------------- |
| Creator       | `post:create`                                                                 |
| Reviewer      | `post:review`                                                                 |
| Publisher     | `post:review`, `post:publish`, `post:assign`                                  |
| Administrator | All declared permissions, including `staff:manage` and `interaction:moderate` |

Roles are invitation convenience bundles. Authorization uses permissions plus ownership and revision state, not a role-name comparison. Publisher does not automatically include creator permission. Administrator does not bypass the rule that the reviewer must differ from the owner/assignee. `interaction:moderate` has no implemented moderation endpoint.

The bootstrap command grants the first administrator only when Staff is empty, using an advisory transaction lock. Later staff join through invitations. Invitation tokens are random, stored as hashes, bound to the invited verified email, expire in 48 hours, and can be accepted once. Acceptance replaces that user's staff permission list with the invitation's bundle and resets their session MFA flags. Invitations are returned for private delivery; no automatic invitation mail sender is implemented.

## Trust boundaries

| Boundary                         | Implemented control                                                             | Operational responsibility                                                             |
| -------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Browser to application           | Same-origin API proxies; mutation Origin allowlist; server DTO validation       | Configure exact origins and separate production hostnames                              |
| Internet to infrastructure       | Compose binds proxy ports only on loopback; app containers expose private ports | Supply TLS ingress/firewall and trusted forwarded-header handling                      |
| Authenticated reader to staff    | Current DB staff permissions and MFA session checks                             | Govern staff grants and review privileged access                                       |
| Staff to content                 | Permission, ownership, independent reviewer, and revision transition checks     | Maintain separate review identities and process                                        |
| API/worker to database           | Prisma transactions, locks, SQL constraints                                     | Least-privilege runtime identity, separate migration identity, encrypted backup access |
| Public rendering to private data | Public queries return only published pointer; cache allowlist and bypass rules  | Do not add caches or cookie forwarding without isolation testing                       |
| Application to mail              | SMTP transport with configured credentials                                      | Operate trusted mail service and verify TLS/provider settings                          |

API middleware rejects POST, PUT, PATCH, and DELETE without an exact trusted Origin, including command-line mutations. Production startup rejects non-HTTPS trusted origins. Host-only cookies are not isolated by port: localhost development is not representative of hostname isolation in production.

Nest throttles domain endpoints by default at 120 requests per 60 seconds. Public content/discovery routes opt out because server rendering shares an internal source address. Better Auth uses database-backed rate limits (default 30 per minute, sign-in and two-factor rules 5, reset requests 3). Nginx separately limits proxied `/api` traffic. Do not assume the Nest limiter is a cluster-wide quota; evaluate behavior when adding replicas.

## Sensitive data and logging

Keep database credentials, auth secrets, SMTP credentials, session cookies, invitation links, email/recovery codes, and authenticated load-test cookies out of source control and shared logs. The Pino logger redacts configured sensitive fields; request serialization excludes bodies and query strings. This does not make arbitrary new log fields safe automatically.

OpenTelemetry exports only when configured and instrumentation is loaded. Review telemetry destinations, access, and retention before enabling export. AuditEvent records publishing and staff mutations, not a complete authentication/security audit stream. It is not tamper-evident. Test traces/screenshots may contain user content; CI retains failure reports for 14 days.

## Production decisions still required

Assign release and incident owners, access-review procedures, secret rotation/revocation procedures, retention/erasure policy, security monitoring destinations, recovery objectives, and a tested restore process. No staff revocation management UI, enterprise SSO, tenant isolation, or compliance evidence system is implemented. Use reviewed administrative procedures for emergency session/staff changes; do not grant access by bypassing guards or disabling MFA.

See [operations](operations.md) for deployment checks, incident diagnosis, backup handling, and the distinction between local verification and production readiness.
