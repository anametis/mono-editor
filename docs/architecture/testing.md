# Browser tests and shared UI stories

Playwright is the browser test runner. Storybook is the shared UI catalog; Playwright also tests its built stories. Jest and Vitest remain for fast backend policies and form logic.

## Commands

```sh
# Interactive component catalog, normally http://localhost:6006
pnpm nx run ui:storybook

# Build static Storybook and test it in an isolated browser (no database or SMTP)
pnpm nx run ui:test-storybook

# Application journey: staff OTP, publishing, public reading, private bookmarks
pnpm nx run admin:e2e
```

Install browsers with `pnpm exec playwright install --with-deps chromium`. For local checks using installed Chrome, prefix a test command with `PLAYWRIGHT_CHANNEL=chrome`.

`ui:test-storybook` depends on the cacheable `ui:build-storybook` target. Browser tests themselves are uncached. The Nx Storybook plugin infers catalog serve/build targets from `libs/shared/ui/.storybook/main.ts`. The explicit Playwright target runs the built catalog on port 4400 and shuts its server down afterward.

## Where things live

- `libs/shared/ui/src/*.stories.tsx`: typed Component Story Format examples beside reusable components. Include normal, disabled, error, and interaction states that actually exist.
- `libs/shared/ui/.storybook/preview.ts`: imports `@kara/tokens/styles.css`, the same theme used by admin and web. Do not copy design tokens into Storybook.
- `tests/ui/components.spec.ts`: isolated component browser checks, including keyboard activation, announcement roles, and responsive dark-mode behavior.
- `playwright.config.ts` and `tests/e2e/`: the real application journey. This currently belongs to the admin Nx target but verifies both frontends and the API.

## Conventions

Use role/label selectors and Playwright's awaited assertions. Each test receives a fresh browser context. Create unique test data, clean it up, and never use a production database. Keep secrets and authenticated storage state out of Git and shared reports.

The publishing suite runs one worker because it owns a local SMTP port and exercises real database/authentication state. Component tests have no service dependencies and can run in parallel. Do not add arbitrary sleeps or retry the entire publishing flow to mask authentication failures.

CI rejects `test.only`, builds the applications first, and runs the publishing journey against the built API, Vite preview, and Next production server. Both browser suites retain failure screenshots/traces and separate HTML reports. CI uploads these artifacts on failure with 14-day retention. Reports can contain page content and should stay within the team's access controls.

Chromium is the initial required browser. Add Firefox/WebKit projects and CI browser installs when the product's browser-support policy requires them. These functional and keyboard checks are not a complete accessibility audit or pixel-diff visual regression suite.

Sources: [Nx Storybook](https://nx.dev/docs/technologies/test-tools/storybook/introduction), [Storybook stories in Playwright](https://storybook.js.org/docs/writing-tests/integrations/stories-in-end-to-end-tests), [Playwright best practices](https://playwright.dev/docs/best-practices).

## Local verification

On 2026-09-25, the Storybook production build and all five component checks passed in installed Chrome. The publishing journey also passed against built API/admin assets and Next's standalone server. Root TypeScript checks, the Storybook TypeScript configuration, and ESLint/boundary checks passed. Remote CI has not been run from this task.
