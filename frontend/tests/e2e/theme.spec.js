// @ts-check
/**
 * Light and dark mode change colors only: every picture, icon, heading, text, button and field
 * keeps the same place and size in both (demo data from `php artisan migrate:fresh --seed`).
 */
import { expect, test } from "@playwright/test";

const PASSWORD = "Password123!";

/**
 * Where everything is on the page: one box per visible element, in reading order.
 * @param {import("@playwright/test").Page} page
 */
async function layout(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("img, svg, h1, h2, h3, p, button, a, input, label, li")]
      .filter((element) => !element.closest("#toasts") && !element.closest("[aria-live]"))
      .map((element) => {
        const box = element.getBoundingClientRect();
        // The theme button says "Dark" in light mode and "Light" in dark mode; it is the same button.
        const themeButton = element.closest('[aria-label^="Switch to"]');
        const words = themeButton ? "theme button" : (element.textContent ?? element.getAttribute("alt") ?? "").trim().slice(0, 25);
        return { what: `${element.tagName.toLowerCase()} ${words}`, x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
      })
      .filter((box) => box.w > 0 && box.h > 0),
  );
}

/**
 * Opens the page in one mode and waits until it has finished loading.
 * @param {import("@playwright/test").Page} page
 * @param {string} path
 * @param {"light" | "dark"} theme
 */
async function open(page, path, theme) {
  await page.evaluate((value) => localStorage.setItem("theme", value), theme);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await page.waitForTimeout(300);
}

/**
 * The boxes that differ between light and dark, if any.
 * @param {import("@playwright/test").Page} page
 * @param {string} path
 */
async function differences(page, path) {
  await open(page, path, "light");
  const light = await layout(page);
  await open(page, path, "dark");
  const dark = await layout(page);
  const changed = [];
  for (let index = 0; index < Math.max(light.length, dark.length); index += 1) {
    const [a, b] = [light[index], dark[index]];
    if (!a || !b || a.what !== b.what) {
      changed.push(`different elements at #${index}: ${a?.what} | ${b?.what}`);
      break;
    }
    if (a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h) changed.push(`${a.what}: ${a.x},${a.y} ${a.w}×${a.h} → ${b.x},${b.y} ${b.w}×${b.h}`);
  }
  return changed;
}

const PUBLIC = ["/", "/login", "/signup", "/forgot-password", "/guest"];
const SIGNED_IN = ["/dashboard", "/schedule", "/subjects", "/teachers", "/sections", "/time-slots", "/buildings", "/report-settings", "/reports", "/approvals", "/users", "/school-years"];

for (const [width, height] of [[1366, 768], [390, 844]]) {
  test(`light and dark keep every size and place at ${width}×${height}`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height });
    await page.goto("/");
    /** @type {Record<string, string[]>} */
    const report = {};
    for (const path of PUBLIC) report[path] = await differences(page, path);

    await page.evaluate(() => localStorage.setItem("theme", "light"));
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("admin@deped.gov.ph");
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    for (const path of SIGNED_IN) report[path] = await differences(page, path);

    expect(Object.fromEntries(Object.entries(report).filter(([, changed]) => changed.length))).toEqual({});
  });
}
