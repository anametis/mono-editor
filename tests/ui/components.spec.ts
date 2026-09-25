import { expect, test } from "@playwright/test";

test("button supports keyboard activation", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-button--interactive&viewMode=story");
  const button = page.getByRole("button", { name: "Activated 0 times" });
  await expect(button).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button")).toHaveText("Activated 1 times");
});

test("disabled button cannot be activated", async ({ page }) => {
  await page.goto("/iframe.html?id=ui-button--disabled&viewMode=story");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
});

for (const [story, role, message] of [
  ["status", "status", "Your changes have been saved."],
  ["error", "alert", "Unable to save. Please try again."],
] as const) {
  test(`notice exposes ${role} semantics`, async ({ page }) => {
    await page.goto(`/iframe.html?id=ui-notice--${story}&viewMode=story`);
    await expect(page.getByRole(role)).toHaveText(message);
  });
}

test("shared theme responds to dark mode on a small viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/iframe.html?id=ui-notice--status&viewMode=story");
  const notice = page.getByRole("status");
  await expect(notice).toBeVisible();
  const light = await notice.evaluate((el) => getComputedStyle(el).color);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() => notice.evaluate((el) => getComputedStyle(el).color))
    .not.toBe(light);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
