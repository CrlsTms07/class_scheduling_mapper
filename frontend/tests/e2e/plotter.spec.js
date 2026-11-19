// @ts-check
/**
 * Key flows of the new app (demo data from `php artisan migrate:fresh --seed`):
 * sign in, place a class by tapping, a conflict that explains itself, submit for approval,
 * and the section page at phone, phone-landscape and laptop sizes.
 */
import { expect, test } from "@playwright/test";

const PASSWORD = "Password123!";
const SECTION_A = process.env.E2E_SECTION_A;
const SECTION_B = process.env.E2E_SECTION_B;
const SHOTS = process.env.E2E_SHOTS ?? "test-results/shots";

/** @param {import("@playwright/test").Page} page */
async function signIn(page, email = "glc@deped.gov.ph") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Picks an option in a searchable select by typing.
 * @param {import("@playwright/test").Page} page
 * @param {string} label
 * @param {string} text
 */
async function choose(page, label, text) {
  await page.getByRole("dialog").getByLabel(label, { exact: true }).click();
  await page.getByLabel(`Search ${label.toLowerCase()}`).fill(text);
  await page.getByRole("option", { name: new RegExp(text) }).first().click();
}

test.describe.configure({ mode: "serial" });

test("signs in and shows the term being worked on", async ({ page }) => {
  await signIn(page);
  await expect(page.getByText(/Second Term/).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "6 · Teacher Loading" })).toBeVisible();
});

test("places a class by tapping a subject, then a lit period", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page);
  await page.goto(`/schedule/sections/${SECTION_A}`);
  await expect(page.getByRole("heading", { level: 1, name: "Grade 7 – Sample A" })).toBeVisible();

  await page.getByRole("button", { name: /Homeroom Guidance/ }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Placing Homeroom Guidance" })).toBeVisible();
  const lit = page.getByRole("button", { name: /^Add class on Monday/ }).filter({ hasText: "Place here" });
  await expect(lit.first()).toBeVisible();

  await lit.first().click();
  await expect(page.getByText(/Homeroom Guidance was placed/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Homeroom Guidance, Monday/ }).first()).toBeVisible();
});

test("offers only free periods, and explains a conflict with the same teacher", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page);
  await page.goto(`/schedule/sections/${SECTION_B}`);
  await expect(page.getByRole("heading", { level: 1, name: "Grade 7 – Sample B" })).toBeVisible();

  // The period Sample A just took for Homeroom (same teacher) is not offered for Monday.
  await page.getByRole("button", { name: /^Add class on Monday at 6:30 AM/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /Add class · Monday/ })).toBeVisible();
  await choose(page, "Subject", "Homeroom Guidance");
  await expect(dialog.getByText(/Monday: .* is teaching/)).toBeVisible();

  // That period shows as a Full block with the reason, before anything is saved; it cannot be chosen.
  const full = dialog.getByRole("radio", { name: /^6:30 AM – 7:15 AM/ });
  await expect(full).toHaveAttribute("aria-disabled", "true");
  await expect(full).toContainText("Full");
  // aria-disabled: Playwright will not click it unless forced, but a person can, and is told why.
  await full.click({ force: true });
  await expect(dialog.getByText(/6:30 AM – 7:15 AM cannot be used: .* is teaching .*Sample A/)).toBeVisible();
});

test("submits for approval after checking each flag", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page);
  await page.goto(`/schedule/sections/${SECTION_A}`);
  await page.getByRole("button", { name: "Submit for approval" }).click();

  const dialog = page.getByRole("dialog");
  const boxes = dialog.getByRole("checkbox");
  const submit = dialog.getByRole("button", { name: "Submit for approval" });
  if ((await boxes.count()) > 0) {
    await expect(submit).toBeDisabled();
    for (const box of await boxes.all()) await box.check();
  }
  await submit.click();
  await expect(page.getByText(/was sent to the Admin for approval/)).toBeVisible();
  await expect(page.getByText("Pending approval").first()).toBeVisible();
});

for (const [width, height] of [[360, 640], [844, 390], [1366, 768]]) {
  test(`fits a ${width}×${height} screen without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page);
    await page.goto(`/schedule/sections/${SECTION_B}`);
    await expect(page.getByRole("heading", { level: 1, name: "Grade 7 – Sample B" })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // Every visible button and link is at least 44×44 px (touch targets).
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("button, a")]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 1 && box.height > 1 && !element.closest("table") && (box.height < 44 || box.width < 44);
        })
        .map((element) => `${Math.round(element.getBoundingClientRect().width)}x${Math.round(element.getBoundingClientRect().height)} ${(element.textContent ?? "").trim().slice(0, 30)}`),
    );
    expect(small).toEqual([]);

    await page.screenshot({ path: `${SHOTS}/section-${width}x${height}.png`, fullPage: true });
  });
}
