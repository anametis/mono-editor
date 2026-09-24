# Verification evidence

Local verification on 2026-09-24 uses Node 22, PostgreSQL on an isolated `kara_test` database, and installed Google Chrome. No production deployment or capacity certification is implied.

| Check | Evidence |
| --- | --- |
| TypeScript and ESLint | Strict type checking and lint pass; tags validated on all 15 Nx projects. |
| Architecture enforcement | Negative import checks reject frontend-to-backend imports, API clients in UI, React in universal libraries, and Node imports in browser projects. |
| Unit tests | Jest covers editorial permission policies; Vitest covers draft form validation. |
| PostgreSQL integration | Draft creation, ownership denial, independent review, approval invalidation, concurrent publication, cancellation, and preserving the published revision pass against real PostgreSQL. |
| Authentication integration | Actual SMTP delivery, email verification, username/password, OTP enrollment and login, password-only staff denial, pending-OTP denial, single-use invitations, permission-change session invalidation, and cross-origin denial pass. |
| Browser journey | Chrome completes staff OTP, draft, review, scheduling/cancellation, publication, public rendering, authenticated save/list/remove, keyboard focus, mobile overflow checks, and sitemap discovery. |
| Cache isolation | Dockerized Nginx checks cookie/auth/RSC/navigation/query bypass, Set-Cookie/error exclusion, and public cache isolation. After 61 seconds, origin failure returns an error rather than expired HTML. Tested with locally available Nginx 1.29; deployment configuration pins 1.28. |
| Backup recovery | `pg_dump` and `pg_restore` succeed into a separate temporary database; the check removes that database afterward. |
| Builds | All four application production builds pass. The container build pipeline also completes on Linux. Rebuild the image from the final checkout before deployment. |

Run commands are in the root README. Contract generation is part of the Nx build dependencies; CI checks committed output for drift. The CI workflow has been authored and run locally in equivalent pieces; there is no configured remote CI run to report.

## Remaining deployment verification

- Configure actual HTTPS origins, trusted ingress IP handling, SMTP, production database credentials, OTLP collection, and alert destinations.
- Run `tools/load.mjs` against the intended staging topology with anonymous cached, uncached, and authenticated traffic. Instance counts and three-minute publication freshness under peak load remain unmeasured.
- Measure field p75 LCP, INP, and CLS after real traffic exists; browser functional checks cannot establish those percentiles.
- Exercise off-host backup restoration and migration rollback/recovery on a production-sized copy. The local dump/restore check is not an off-host disaster-recovery drill.
- Test host-only session isolation on the actual separate HTTPS admin and public hostnames. Localhost ports do not create distinct cookie domains.

Content is plain text in this slice. Rich text, image upload pipelines, SMS, and additional interaction types remain outside the implemented scope.
