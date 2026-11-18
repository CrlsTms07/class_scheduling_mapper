// @ts-check
/**
 * The Guest view, with no sign-in. This file runs last (its name starts with "zz") because it
 * approves Sample B, which locks it for the other files.
 */
import { expect, test } from "@playwright/test";

const PASSWORD = "Password123!";
const SECTION_B = process.env.E2E_SECTION_B;
const SHOTS = process.env.E2E_SHOTS ?? "test-results/shots";

/**
 * @param {import("@playwright/test").Page} page
 * @param {string} email
 */
async function signIn(page, email) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe.configure({ mode: "serial" });

test("shows a section only once it is approved, with the adviser and no teacher names", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  // Not approved yet: the guest is told so.
  await page.context().clearCookies();
  await page.goto(`/guest/sections/${SECTION_B}`);
  await expect(page.getByText(/not ready yet|being updated/)).toBeVisible();

  // The Chairperson submits Sample B (it already has Values Education on Friday), the Admin approves it.
  await signIn(page, "glc@deped.gov.ph");
  await page.goto(`/schedule/sections/${SECTION_B}`);
  await expect(page.getByRole("heading", { level: 1, name: "Grade 7 – Sample B" })).toBeVisible();
  await expect(page.getByText(/^Subjects ·/)).toBeVisible();
  if ((await page.getByRole("button", { name: /^Add class on Friday at 3:50 PM/ }).count()) > 0) {
    await page.getByRole("button", { name: /^Add class on Friday at 3:50 PM/ }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Subject", { exact: true }).click();
    await page.getByLabel("Search subject").fill("Values Education");
    await page.getByRole("option", { name: /Values Education/ }).first().click();
    await dialog.getByRole("button", { name: "Add class" }).click();
    await expect(page.getByText("Values Education was added.")).toBeVisible();
  }
  await page.getByRole("button", { name: "Submit for approval" }).click();
  const submit = page.getByRole("dialog");
  for (const box of await submit.getByRole("checkbox").all()) await box.check();
  await submit.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByText(/was sent to the Admin for approval/)).toBeVisible();

  await signIn(page, "admin@deped.gov.ph");
  await page.goto("/approvals");
  await page.getByRole("button", { name: "Approve Grade 7 – Sample B" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Approve 1 section/ }).click();
  await expect(page.getByText(/Approved \d+ classes in 1 section/)).toBeVisible();

  // A visitor finds it by department, grade and section.
  await page.context().clearCookies();
  await page.goto("/");
  await page.getByRole("link", { name: "View class schedules" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Find your class schedule" })).toBeVisible();
  await page.getByRole("button", { name: "Browse all sections" }).click();
  await page.getByRole("button", { name: "Junior High School" }).click();
  await page.getByRole("button", { name: "Grade 7", exact: true }).click();
  await page.getByRole("link", { name: /Grade 7 – Sample B/ }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Grade 7 – Sample B" })).toBeVisible();
  await expect(page.getByText("Class Adviser: Teacher Sample 2")).toBeVisible();
  await expect(page.getByText("Values Education").first()).toBeVisible();
  // Subject teachers stay private on the public page.
  await expect(page.locator("main")).not.toContainText("Teacher Sample 1");

  await page.getByRole("button", { name: "QR code" }).click();
  await expect(page.getByRole("img", { name: /QR code for the schedule of Grade 7 – Sample B/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Download Class Program of .* as PDF/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /XLSX|CSV/ })).toHaveCount(0);
});

test("finds a section by its adviser, never by a student", async ({ page }) => {
  await page.goto("/guest");
  await page.getByLabel("Search a section or adviser").fill("Teacher Sample 1");
  await expect(page.getByRole("link", { name: /Grade 7 – Sample A/ })).toBeVisible();
  await page.getByLabel("Search a section or adviser").fill("Juan Dela Cruz");
  await expect(page.getByText("No section or adviser matches your search.")).toBeVisible();
});

test("switches to dark mode and remembers it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

for (const [width, height] of [[360, 640], [844, 390], [1366, 768]]) {
  test(`public pages fit ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const [path, ready] of [["/", /View class schedules/], ["/guest", /Find your class schedule/], [`/guest/sections/${SECTION_B}`, /Class Adviser/], ["/login", /Sign in/]]) {
      await page.goto(String(path));
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
      await page.screenshot({ path: `${SHOTS}/public${String(path).replace(/\W+/g, "-")}-${width}x${height}.png`, fullPage: true });
    }
  });
}
