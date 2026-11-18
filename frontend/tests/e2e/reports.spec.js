// @ts-check
/**
 * Reports: every tab opens, files download as PDF and CSV only (team decision, Nov 18, 2026),
 * and the page fits phones and laptops (demo data from `php artisan migrate:fresh --seed`).
 */
import { expect, test } from "@playwright/test";

const PASSWORD = "Password123!";
const SHOTS = process.env.E2E_SHOTS ?? "test-results/shots";

/** @param {import("@playwright/test").Page} page */
async function signIn(page, email = "admin@deped.gov.ph") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("opens every report", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page);
  const expected = {
    schedules: /Grade 7 – Sample A/,
    rooms: /periods a week/,
    timetable: /Grade 7 Timetable|Sample A/,
    teacher: /Total per week/,
    load: /over their limit/,
    advisers: /GRADE 7/,
    validation: /issue/,
  };
  for (const [tab, text] of Object.entries(expected)) {
    await page.goto(`/reports?tab=${tab}`);
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await expect(page.getByText(text).locator("visible=true").first()).toBeVisible();
    await expect(page.locator(".skeleton")).toHaveCount(0);
  }
});

test("downloads PDF and CSV, and never offers XLSX", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page);
  await page.goto("/reports?tab=load");

  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Teacher Load Report as CSV" }).click();
  expect((await csv).suggestedFilename()).toMatch(/^teacher-load.*\.csv$/);
  await expect(page.getByText(/\.csv was downloaded\./)).toBeVisible();

  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Teacher Load Report as PDF" }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);

  for (const tab of ["schedules", "rooms", "teacher", "validation"]) {
    await page.goto(`/reports?tab=${tab}`);
    await expect(page.locator(".skeleton")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /XLSX/ })).toHaveCount(0);
  }
});

for (const [width, height] of [[360, 640], [844, 390], [1366, 768]]) {
  test(`reports fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page);
    for (const tab of ["schedules", "teacher", "advisers"]) {
      await page.goto(`/reports?tab=${tab}`);
      await expect(page.locator(".skeleton")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("button, a, summary")]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 1 && box.height > 1 && !element.closest("table") && (box.height < 44 || box.width < 44);
          })
          .map((element) => `${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)} ${(element.textContent ?? "").trim().slice(0, 30)}`),
      );
      expect(small).toEqual([]);
      const spilled = await page.evaluate(() =>
        [...document.querySelectorAll("button, a, [role=tab]")]
          .filter((element) => element.getBoundingClientRect().width > 1 && element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflow === "visible")
          .map((element) => (element.textContent ?? "").trim().slice(0, 40)),
      );
      expect(spilled).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/reports-${tab}-${width}x${height}.png`, fullPage: true });
    }
  });
}
