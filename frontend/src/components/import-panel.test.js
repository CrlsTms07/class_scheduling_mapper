// @ts-check
import { describe, expect, it } from "vitest";
import { canImport, importRowsList, importSummaryText } from "./import-panel.js";

/**
 * @param {Partial<import("@/api/imports.js").ImportResult>} [overrides]
 * @returns {import("@/api/imports.js").ImportResult}
 */
const result = (overrides = {}) => ({
  mode: "preview",
  rows: [
    { row_number: 2, label: "Juan Dela Cruz (4512301)", status: "new", messages: [] },
    { row_number: 3, label: "Rina Lopez (4512303)", status: "error", messages: ['Row 3: department "TLE-ICTT" does not exist.'] },
  ],
  summary: { total: 2, new: 1, update: 0, skip: 0, error: 1 },
  added: 1,
  updated: 0,
  skipped: 0,
  errors: 1,
  ...overrides,
});

describe("import panel", () => {
  it("allows Import only when a row would be added or updated", () => {
    expect(canImport(result())).toBe(true);
    expect(canImport(result({ summary: { total: 2, new: 0, update: 0, skip: 1, error: 1 } }))).toBe(false);
  });

  it("sums up a review and a finished import in words", () => {
    expect(importSummaryText(result())).toBe("1 new, 0 to update, 0 to skip, 1 with an error.");
    expect(importSummaryText(result({ mode: "commit", summary: { total: 50, new: 45, update: 3, skip: 2, error: 0 } }))).toBe("45 added, 3 updated, 2 skipped, 0 errors.");
  });

  it("shows the rows with errors first, with the reason, and can show all", () => {
    const list = importRowsList(result());
    document.body.append(list);

    expect(list.querySelectorAll("li")).toHaveLength(1);
    expect(list.textContent).toContain("Row 3: Rina Lopez (4512303)");
    expect(list.textContent).toContain('department "TLE-ICTT" does not exist.');
    expect(list.textContent).not.toContain("Row 3: department");

    /** @type {HTMLButtonElement} */ (list.querySelector("button")).click();
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(list.querySelector("li .badge")?.textContent).toBe("New");
  });
});
