// @ts-check
/**
 * Every other page of the new app: dashboards, setup steps, Admin pages, the account pages, the
 * guide, rooms and buildings (demo data from `php artisan migrate:fresh --seed`).
 */
import { expect, test } from "@playwright/test";

const PASSWORD = "Password123!";
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

/**
 * Fills a text field of the open dialog.
 * @param {import("@playwright/test").Page} page
 * @param {string} label
 * @param {string} value
 */
async function fill(page, label, value) {
  await page.getByRole("dialog").getByRole("textbox", { name: new RegExp(`^${label}`) }).first().fill(value);
}

/**
 * Picks an option of a searchable dropdown in the open dialog.
 * @param {import("@playwright/test").Page} page
 * @param {string} label
 * @param {string} option
 */
async function choose(page, label, option) {
  await page.getByRole("dialog").getByRole("button", { name: new RegExp(`^${label}`) }).first().click();
  await page.getByRole("option", { name: new RegExp(option) }).first().click();
}

test.describe.configure({ mode: "serial" });

test("dashboards fit each role", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@deped.gov.ph");
  await expect(page.getByText("Accounts to activate")).toBeVisible();
  await expect(page.getByRole("region", { name: "Steps to make the schedule" })).toBeVisible();

  await signIn(page, "glc@deped.gov.ph");
  await expect(page.getByRole("region", { name: "Steps to make the schedule" })).toBeVisible();
  await expect(page.getByText("Waiting for approval")).toBeVisible();

  await signIn(page, "teacher@deped.gov.ph");
  await expect(page.getByText("Next class")).toBeVisible();
  await page.getByRole("link", { name: "Open My Schedule" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My Schedule" })).toBeVisible();
  await page.goto("/my-profile");
  await expect(page.getByRole("heading", { level: 1, name: "My Profile" })).toBeVisible();
  // A teacher cannot open the setup pages.
  await page.goto("/sections");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("adds a building with a room, a bell schedule from a preset, a subject, a section and a teacher", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@deped.gov.ph");

  await page.goto("/buildings");
  await page.getByRole("button", { name: "Add building" }).first().click();
  await fill(page, "Building name", "Annex E2E");
  await page.getByRole("dialog").getByRole("button", { name: "Add building" }).click();
  await expect(page.getByText("Annex E2E was added.")).toBeVisible();
  await page.getByRole("region", { name: "Annex E2E" }).getByRole("button", { name: "Add room" }).click();
  await fill(page, "Room number", "301");
  await page.getByRole("dialog").getByRole("button", { name: "Add room" }).click();
  await expect(page.getByText("Room 301 was added.")).toBeVisible();

  await page.goto("/time-slots");
  await page.getByRole("tab", { name: "Morning (AM)" }).click();
  await page.getByRole("button", { name: "Add bell schedule" }).first().click();
  await fill(page, "Name", "AM Monday – Friday");
  for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) await page.getByRole("dialog").getByRole("button", { name: day }).click();
  await choose(page, "Shift", "Morning");
  await page.getByRole("dialog").getByRole("button", { name: "Add bell schedule" }).click();
  await expect(page.getByText("AM Monday – Friday was added.")).toBeVisible();
  await page.getByRole("region", { name: "AM Monday – Friday" }).getByRole("button", { name: "Use a preset" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fill the bell schedule" }).click();
  await expect(page.getByText("AM Monday – Friday now has 10 rows.")).toBeVisible();

  await page.goto("/subjects");
  await page.getByRole("button", { name: "Add subject" }).first().click();
  // Subject name is a searchable list of the names already used; a new one is typed and chosen with Use.
  await page.getByRole("dialog").getByRole("button", { name: /^Subject name/ }).click();
  await page.getByLabel("Search subject name").fill("Robotics E2E");
  await page.getByRole("option", { name: 'Use "Robotics E2E"' }).click();
  await choose(page, "Grade level", "Grade 8");
  await page.getByRole("dialog").getByRole("spinbutton", { name: /^Minutes per week/ }).fill("120");
  await page.getByRole("dialog").getByRole("button", { name: "Add subject" }).click();
  await expect(page.getByText("Robotics E2E was added.")).toBeVisible();

  await page.goto("/sections");
  await page.getByRole("button", { name: "Add section" }).first().click();
  await fill(page, "Section name", "Diligence E2E");
  await choose(page, "Grade level", "Grade 8");
  await page.getByRole("dialog").getByRole("button", { name: "Add section" }).click();
  await expect(page.getByText("Diligence E2E was added.")).toBeVisible();

  await page.goto("/teachers");
  await page.getByRole("button", { name: "Add teacher" }).first().click();
  await fill(page, "First name", "Rosa");
  await fill(page, "Last name", "Bautista");
  await choose(page, "Department", "Mathematics");
  await page.getByRole("dialog").getByRole("button", { name: "Add a degree" }).click();
  await page.getByRole("dialog").getByLabel("Degree", { exact: true }).fill("BSEd Mathematics");
  await page.getByRole("dialog").getByRole("button", { name: "Add teacher" }).click();
  await expect(page.getByText("Rosa Bautista was added.")).toBeVisible();
  await page.getByRole("link", { name: /Bautista/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: /Bautista/ })).toBeVisible();
  await expect(page.getByText("BSEd Mathematics")).toBeVisible();
});

test("a new sign-up is activated by the Admin", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.context().clearCookies();
  await page.goto("/signup");
  await page.getByLabel("First name").fill("Liza");
  await page.getByLabel("Last name").fill("Ramos");
  await page.getByLabel("Email", { exact: true }).fill("liza.ramos@deped.gov.ph");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Please read and accept the Terms and Conditions.")).toBeVisible();
  await page.getByLabel(/accept the Terms and Conditions/).check();
  await page.getByLabel(/Data Privacy Notice/).check();
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Account created" })).toBeVisible();

  await signIn(page, "admin@deped.gov.ph");
  await page.goto("/users");
  await expect(page.getByRole("region", { name: "Sign-ups waiting" })).toContainText("Liza Ramos");
  await page.getByRole("region", { name: "Sign-ups waiting" }).getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Activate selected as Teacher" }).click();
  await expect(page.getByRole("region", { name: "Sign-ups waiting" })).toHaveCount(0);
});

test("signing out says so, also from the phone menu", async ({ page }) => {
  for (const [width, height, fromMenu] of [[1366, 768, false], [390, 844, true]]) {
    await page.setViewportSize({ width: Number(width), height: Number(height) });
    await signIn(page, "admin@deped.gov.ph");
    if (fromMenu) await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Sign out" }).last().click();
    await page.getByRole("button", { name: "Yes, sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("status").filter({ hasText: "Signed out." })).toBeVisible();
  }
});

test("the school years, report settings, guide, rooms and buildings open", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await signIn(page, "admin@deped.gov.ph");
  await page.goto("/school-years");
  await page.getByRole("button", { name: "Start a new school year" }).first().click();
  await expect(page.getByRole("dialog").getByText("1. Name and dates")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Calendar settings" }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: /Calendar settings/ })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

  await page.goto("/report-settings");
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByRole("dialog").getByRole("textbox", { name: /^Tagline/ }).fill("Excellence in every class");
  await page.getByRole("dialog").getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("The school profile was saved.")).toBeVisible();
  await page.getByRole("tab", { name: "Signatories" }).click();
  await expect(page.getByRole("button", { name: "Add signatory" })).toBeVisible();

  await page.goto("/schedule");
  await page.getByRole("tab", { name: "Sample Building" }).click();
  await page.getByRole("link", { name: "View building" }).click();
  await expect(page.getByText(/floor/i).first()).toBeVisible();
  await page.getByRole("link", { name: /Room 101/ }).first().click();
  await expect(page.getByRole("region", { name: "Monday" })).toBeVisible();
});

const PAGES = [
  ["admin@deped.gov.ph", ["/dashboard", "/buildings", "/time-slots", "/subjects", "/sections", "/teachers", "/users", "/school-years", "/report-settings"]],
  ["teacher@deped.gov.ph", ["/dashboard", "/my-schedule", "/my-profile"]],
];

for (const [width, height] of [[360, 640], [844, 390], [1366, 768]]) {
  test(`every page fits ${width}×${height}`, async ({ page }) => {
    // Thirteen pages and two sign-ins: more time than one flow needs.
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height });
    for (const [email, paths] of PAGES) {
      await signIn(page, String(email));
      for (const path of /** @type {string[]} */ (paths)) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator(".skeleton")).toHaveCount(0);
        const problems = await page.evaluate(() => {
          const out = [];
          if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) out.push(`page is ${document.documentElement.scrollWidth}px wide`);
          for (const element of document.querySelectorAll("button, a")) {
            const box = element.getBoundingClientRect();
            if (box.width <= 1 || box.height <= 1 || element.closest("table")) continue;
            if (box.height < 44 || box.width < 44) out.push(`small ${Math.round(box.width)}x${Math.round(box.height)} ${(element.textContent ?? "").trim().slice(0, 30)}`);
            if (element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflow === "visible") out.push(`spills: ${(element.textContent ?? "").trim().slice(0, 30)}`);
          }
          return out;
        });
        expect(problems, path).toEqual([]);
        await page.screenshot({ path: `${SHOTS}/page${path.replace(/\W+/g, "-")}-${width}x${height}.png`, fullPage: true });
      }
    }
  });
}
