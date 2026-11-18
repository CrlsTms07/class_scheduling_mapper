// @ts-check
/**
 * Approvals: the Chairperson submits, the Admin cannot reject without a reason, approves, and
 * reopens with a reason (demo data from `php artisan migrate:fresh --seed`).
 */
import { expect, test } from "@playwright/test";

const PASSWORD = "Password123!";
const SECTION_B = process.env.E2E_SECTION_B;

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

test("submit, then approve, then reopen with a reason", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });

  // The Chairperson places one class and submits the schedule.
  await signIn(page, "glc@deped.gov.ph");
  await page.goto(`/schedule/sections/${SECTION_B}`);
  await page.getByRole("button", { name: /^Add class on Friday at 3:50 PM/ }).first().click();
  const classDialog = page.getByRole("dialog");
  await classDialog.getByLabel("Subject", { exact: true }).click();
  await page.getByLabel("Search subject").fill("Values Education");
  await page.getByRole("option", { name: /Values Education/ }).first().click();
  await classDialog.getByRole("button", { name: "Add class" }).click();
  await expect(page.getByText("Values Education was added.")).toBeVisible();

  await page.getByRole("button", { name: "Submit for approval" }).click();
  const submit = page.getByRole("dialog");
  for (const box of await submit.getByRole("checkbox").all()) await box.check();
  await submit.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByText(/was sent to the Admin for approval/)).toBeVisible();

  // The Admin sees it waiting.
  await signIn(page, "admin@deped.gov.ph");
  await page.goto("/approvals");
  await expect(page.getByRole("heading", { level: 1, name: "Approvals" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /^Grade 7 – Sample B/ })).toBeVisible();

  // Rejecting needs a reason.
  await page.getByRole("button", { name: "Reject Grade 7 – Sample B" }).click();
  const reject = page.getByRole("dialog");
  await expect(reject.getByRole("button", { name: /^Reject 1 section/ })).toBeDisabled();
  await reject.getByRole("button", { name: "Cancel" }).click();

  // Approve.
  await page.getByRole("button", { name: "Approve Grade 7 – Sample B" }).click();
  const approve = page.getByRole("dialog");
  await expect(approve.getByText(/1 section, \d+ classes/)).toBeVisible();
  await approve.getByRole("button", { name: /^Approve 1 section/ }).click();
  await expect(page.getByText(/Approved \d+ classes in 1 section/)).toBeVisible();

  // Reopen, with a reason.
  await page.getByRole("tab", { name: /^Approved/ }).click();
  await page.getByRole("button", { name: "Reopen Grade 7 – Sample B" }).click();
  const reopen = page.getByRole("dialog");
  const confirm = reopen.getByRole("button", { name: /^Reopen 1 section/ });
  await expect(confirm).toBeDisabled();
  await reopen.getByLabel(/Reason for reopening/).fill("Please move Values Education to the morning.");
  await confirm.click();
  await expect(page.getByText(/Reopened \d+ classes in 1 section/)).toBeVisible();

  // The Chairperson sees why.
  await signIn(page, "glc@deped.gov.ph");
  await page.goto(`/schedule/sections/${SECTION_B}`);
  await expect(page.getByText(/Reopened by .*Please move Values Education to the morning\./)).toBeVisible();
});

test("fits the whole Admin menu on a 1366×768 laptop (design audit, Must fix #2)", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@deped.gov.ph");
  const menu = page.getByRole("navigation", { name: "Main menu" });
  for (const name of ["Report Settings", "Sign out"]) {
    const box = await menu.getByText(name, { exact: true }).boundingBox();
    expect(box && box.y + box.height).toBeLessThanOrEqual(768);
  }
});

test("keeps Approvals to the Admin", async ({ page }) => {
  await signIn(page, "glc@deped.gov.ph");
  await page.goto("/approvals");
  await expect(page).toHaveURL(/\/dashboard/);
});

for (const [width, height] of [[360, 640], [844, 390], [1366, 768]]) {
  test(`approvals fits ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page, "admin@deped.gov.ph");
    await page.goto("/approvals");
    await page.getByRole("tab", { name: /^All/ }).click();
    await expect(page.getByText(/Grade 7 – Sample A/).locator("visible=true").first()).toBeVisible();

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
    await page.screenshot({ path: `${process.env.E2E_SHOTS ?? "test-results/shots"}/approvals-${width}x${height}.png`, fullPage: true });
  });
}
