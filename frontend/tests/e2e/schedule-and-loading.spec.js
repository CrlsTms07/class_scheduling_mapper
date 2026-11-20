// @ts-check
/**
 * The Schedule page and Teacher Loading (demo data from `php artisan migrate:fresh --seed`).
 */
import { expect, test } from "@playwright/test";

const PASSWORD = "Password123!";
const SHOTS = process.env.E2E_SHOTS ?? "test-results/shots";

/** @param {import("@playwright/test").Page} page */
async function signIn(page, email = "glc@deped.gov.ph") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe.configure({ mode: "serial" });

test("lists the sections and starts a schedule from New schedule", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page);
  await page.goto("/schedule");
  await expect(page.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Grade 7 – Sample A/ }).first()).toBeVisible();

  // Copy is only in New schedule (team decision, Nov 17, 2026). Schedules are never imported
  // from a file (beneficiary review, Nov 20, 2026).
  await page.getByRole("button", { name: "New schedule" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: /Import from a file/ })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /Copy another term's schedule/ })).toBeVisible();

  await dialog.getByRole("button", { name: /Build it on a timetable/ }).click();
  await expect(page).toHaveURL(/\/schedule\/sections\/\d+/);
});

test("finds a section by its adviser", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page);
  await page.goto("/schedule");
  await page.getByLabel("Search rooms and sections").fill("Teacher Sample 2");
  await expect(page.getByRole("link", { name: /Grade 7 – Sample B/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Grade 7 – Sample A/ })).toHaveCount(0);
});

test("gives a subject another teacher, and says so", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page);
  await page.goto("/teacher-loading");
  await expect(page.getByRole("heading", { level: 1, name: "Teacher Loading" })).toBeVisible();
  await expect(page.getByText(/subjects have a teacher/)).toBeVisible();

  await page.getByLabel("Teacher of Filipino", { exact: true }).click();
  await page.getByLabel("Search teacher of filipino").fill("Teacher Sample 9");
  await page.getByRole("option", { name: /Teacher Sample 9/ }).first().click();
  await expect(page.getByText("Teacher Sample 9 now teaches Filipino.")).toBeVisible();
  await expect(page.getByLabel("Teacher of Filipino", { exact: true })).toContainText("Teacher Sample 9");
});

test("shows each teacher's load, with how to fix an overload", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page);
  await page.goto("/teacher-loading?view=teachers");
  await expect(page.getByRole("tab", { name: "By teacher (Load Distribution)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("meter").first()).toBeVisible();
});

for (const [path, name, ready] of [["/schedule", "schedule", /Grade 7 – Sample A/], ["/teacher-loading", "loading", /subjects have a teacher/]]) {
  for (const [width, height] of [[360, 640], [844, 390], [1366, 768]]) {
    test(`${name} fits ${width}×${height} with large enough targets`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await signIn(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Check the real content, not the loading placeholders.
      await expect(page.getByText(ready).first()).toBeVisible();
      await expect(page.locator(".skeleton")).toHaveCount(0);

      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("button, a")]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 1 && box.height > 1 && !element.closest("table") && (box.height < 44 || box.width < 44);
          })
          .map((element) => `${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)} ${(element.textContent ?? "").trim().slice(0, 30)}`),
      );
      expect(small).toEqual([]);

      // No text spills out of its button or tab (like a long tab label on a phone).
      const spilled = await page.evaluate(() =>
        [...document.querySelectorAll("button, a, [role=tab]")]
          .filter((element) => element.getBoundingClientRect().width > 1 && element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflow === "visible")
          .map((element) => (element.textContent ?? "").trim().slice(0, 40)),
      );
      expect(spilled).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/${name}-${width}x${height}.png`, fullPage: true });
    });
  }
}
