// @ts-check
import { describe, expect, it, vi } from "vitest";
import { searchableSelect } from "./searchable-select.js";

const click = (/** @type {Element | null | undefined} */ element) => element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("searchable select with add, rename and delete in the list", () => {
  it("renames a choice right in the list", async () => {
    const rename = vi.fn(async () => {});
    const select = searchableSelect({ label: "Department", options: [{ value: 1, label: "Mathematcs" }], manage: { rename, remove: vi.fn(async () => {}) } });
    document.body.append(select);
    click(select.querySelector("[aria-haspopup=listbox]"));

    click(select.querySelector('[aria-label="Rename Mathematcs"]'));
    const box = /** @type {HTMLInputElement} */ (select.querySelector('[aria-label="New name for Mathematcs"]'));
    box.value = "Mathematics";
    click([...select.querySelectorAll("button")].find((button) => button.textContent === "Save"));
    await flush();

    expect(rename).toHaveBeenCalledWith({ value: 1, label: "Mathematcs" }, "Mathematics");
  });

  it("asks before deleting, and shows the server's reason when it cannot", async () => {
    const remove = vi.fn(async () => { throw new Error("Mathematics is still in use by personnel records (3), so it stays."); });
    const select = searchableSelect({ label: "Department", value: 1, options: [{ value: 1, label: "Mathematics" }], manage: { rename: vi.fn(async () => {}), remove } });
    document.body.append(select);
    click(select.querySelector("[aria-haspopup=listbox]"));

    click(select.querySelector('[aria-label="Delete Mathematics"]'));
    expect(select.textContent).toContain("Delete Mathematics?");
    click([...select.querySelectorAll("button")].find((button) => button.textContent === "Yes, delete"));
    await flush();

    expect(remove).toHaveBeenCalled();
    expect(select.querySelector("[role=alert]")?.textContent).toContain("Something went wrong");
    expect(select.getValue()).toBe(1);
  });
});

describe("adding a new choice", () => {
  it("says how to add when the list is empty, and offers Add after one letter", async () => {
    const run = vi.fn(async () => {});
    const select = searchableSelect({ label: "Department", options: [], create: { label: (typed) => `Add "${typed}"`, run } });
    document.body.append(select);
    click(select.querySelector("[aria-haspopup=listbox]"));

    expect(select.textContent).toContain("Nothing in the list yet. Type a department in the box above, then choose Add.");

    const search = /** @type {HTMLInputElement} */ (select.querySelector("input[type=search]"));
    search.value = "M";
    search.dispatchEvent(new Event("input"));
    click([...select.querySelectorAll("[role=option]")].find((item) => item.textContent?.includes('Add "M"')));
    await flush();

    expect(run).toHaveBeenCalledWith("M");
  });
});

