import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { SMTPServer } from "smtp-server";
import { randomUUID } from "node:crypto";
process.loadEnvFile(".env");
const db = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const password = "Test-password-7291!";
const creator = `creator_${suffix}`,
  reviewer = `reviewer_${suffix}`;
const messages: string[] = [];
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  onData(stream, _session, callback) {
    let data = "";
    stream.on("data", (c) => (data += c));
    stream.on("end", () => {
      messages.push(data.replace(/=\r?\n/g, "").replace(/=3D/g, "="));
      callback();
    });
  },
});
test.beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("kara_test"))
    throw new Error("Use isolated kara_test database");
  await new Promise<void>((resolve) => smtp.listen(1025, "127.0.0.1", resolve));
  for (const [username, permissions] of [
    [creator, ["post:create"]],
    [reviewer, ["post:review", "post:publish"]],
  ] as const) {
    await db.user.create({
      data: {
        id: username,
        name: username,
        username,
        email: `${username}@example.test`,
        emailVerified: true,
        accounts: {
          create: {
            id: randomUUID(),
            providerId: "credential",
            accountId: username,
            password: await hashPassword(password),
          },
        },
        staff: { create: { permissions: [...permissions] } },
      },
    });
  }
});
test.afterAll(async () => {
  const posts = await db.post.findMany({
    where: { ownerId: creator },
    select: { id: true },
  });
  await db.post.updateMany({
    where: { ownerId: creator },
    data: { publishedRevisionId: null },
  });
  await db.post.deleteMany({ where: { ownerId: creator } });
  await db.user.deleteMany({ where: { id: { in: [creator, reviewer] } } });
  await db.auditEvent.deleteMany({
    where: {
      OR: [
        { actorId: { in: [creator, reviewer] } },
        { resourceId: { in: posts.map((p) => p.id) } },
      ],
    },
  });
  await db.$disconnect();
  await new Promise<void>((resolve) => smtp.close(() => resolve()));
});
async function signIn(page: Page, username: string) {
  await page.goto("/account");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Confirm your password").fill(password);
  await page
    .getByRole("button", { name: "Enable two-step verification" })
    .click();
  await expect(page.getByLabel("Email code")).toBeVisible();
  await expect
    .poll(() =>
      [...messages]
        .reverse()
        .find(
          (m) =>
            m.includes(`${username}@example.test`) &&
            m.includes("Your code is"),
        ),
    )
    .toBeTruthy();
  const code = [...messages]
    .reverse()
    .find(
      (m) =>
        m.includes(`${username}@example.test`) && m.includes("Your code is"),
    )!
    .match(/Your code is (\d{6})/)![1]!;
  await page.getByLabel("Email code").fill(code);
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Verification complete");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Editorial desk" }),
  ).toBeVisible();
}
test("create, review, schedule and read a story; save it privately", async ({
  page,
  browser,
}) => {
  await signIn(page, creator);
  await page.getByLabel("Title", { exact: true }).fill("A considered story");
  await page.getByLabel("Slug", { exact: true }).fill(`story-${suffix}`);
  await page
    .getByLabel("Summary", { exact: true })
    .fill("A carefully reviewed public summary.");
  await page
    .getByLabel("Body", { exact: true })
    .fill("A story with <script>alert(1)</script> written as text.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(
    page.locator(".tag").filter({ hasText: "submitted" }),
  ).toBeVisible();
  const reviewContext = await browser.newContext();
  const reviewPage = await reviewContext.newPage();
  await signIn(reviewPage, reviewer);
  await reviewPage
    .getByRole("button", { name: "Approve revision", exact: true })
    .click();
  await expect(
    reviewPage.getByRole("button", { name: "Schedule", exact: true }),
  ).toBeVisible();
  // Pick a future minute in the displayed browser timezone.
  const at = new Date(Date.now() + 120000);
  const local = new Date(at.getTime() - at.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await reviewPage.getByLabel("Publication time").fill(local);
  await reviewPage
    .getByRole("button", { name: "Schedule", exact: true })
    .click();
  await expect(
    reviewPage.locator(".tag").filter({ hasText: "scheduled" }),
  ).toBeVisible();
  await reviewPage
    .getByRole("button", { name: "Cancel schedule", exact: true })
    .click();
  await reviewPage
    .getByRole("button", { name: "Publish now", exact: true })
    .click();
  await expect(
    reviewPage.locator(".tag").filter({ hasText: "published" }),
  ).toBeVisible();
  const reader = await browser.newPage();
  await reader.goto(`http://localhost:3000/posts/story-${suffix}`);
  await expect(
    reader.getByRole("heading", { name: "A considered story", exact: true }),
  ).toBeVisible();
  await expect(reader.locator(".prose")).toContainText(
    "<script>alert(1)</script>",
  );
  await reader.keyboard.press("Tab");
  await expect(
    reader.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await reader.getByRole("button", { name: "Save story" }).click();
  await expect(reader.getByRole("status")).toContainText("Sign in");
  await reader.screenshot({ path: ".local/public-story.png", fullPage: true });
  await page.screenshot({ path: ".local/editorial.png", fullPage: true });

  await reader.goto("http://localhost:3000/account");
  messages.length = 0;
  await reader.getByLabel("Username", { exact: true }).fill(creator);
  await reader.getByLabel("Password", { exact: true }).fill(password);
  await reader.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(reader.getByLabel("Email code")).toBeVisible();
  await expect
    .poll(() =>
      [...messages]
        .reverse()
        .find(
          (m) =>
            m.includes(`${creator}@example.test`) && m.includes("Your code is"),
        ),
    )
    .toBeTruthy();
  const readerCode = [...messages]
    .reverse()
    .find(
      (m) =>
        m.includes(`${creator}@example.test`) && m.includes("Your code is"),
    )!
    .match(/Your code is (\d{6})/)![1]!;
  await reader.getByLabel("Email code").fill(readerCode);
  await reader
    .getByRole("button", { name: "Verify code", exact: true })
    .click();
  await expect(
    reader.getByRole("heading", { name: `Hello, ${creator}` }),
  ).toBeVisible();
  await reader.goto(`http://localhost:3000/posts/story-${suffix}`);
  await reader.getByRole("button", { name: "Save story" }).click();
  await expect(reader.getByRole("status")).toContainText("Story saved");
  await reader.goto("http://localhost:3000/account");
  await reader.getByRole("button", { name: "Load saved stories" }).click();
  await expect(
    reader.getByRole("link", { name: "A considered story", exact: true }),
  ).toBeVisible();
  await reader.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    reader.getByRole("link", { name: "A considered story", exact: true }),
  ).toHaveCount(0);
  await reader.setViewportSize({ width: 390, height: 844 });
  await reader.goto(`http://localhost:3000/posts/story-${suffix}`);
  await expect(
    reader.getByRole("heading", { name: "A considered story" }),
  ).toBeVisible();
  expect(
    await reader.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await reader.screenshot({ path: ".local/mobile-story.png", fullPage: true });
  const sitemap = await reader.request.get("http://localhost:3000/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain("/sitemaps/1");
  const entries = await reader.request.get("http://localhost:3000/sitemaps/1");
  expect(entries.ok()).toBe(true);
  expect(await entries.text()).toContain(`/posts/story-${suffix}`);
  await reader.close();
  await reviewContext.close();
});
