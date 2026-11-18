// @ts-check
import { describe, expect, it, vi } from "vitest";
import { searchableSelect } from "./searchable-select.js";
import { timePicker } from "./time-picker.js";
import { confirmAction, openDialog } from "./dialog.js";
import { toast } from "./toast.js";
import { openListEditor } from "./list-editor.js";
import { ApiError } from "@/api/client.js";

// jsdom has no <dialog> methods; these stand in for the browser's.
HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close() {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

const type = (input, text) => {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const key = (element, name) => element.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));

describe("searchable select (UI requirement 3)", () => {
  const options = [
    { value: 1, label: "Ana Reyes", hint: "Math" },
    { value: 2, label: "Ben Cruz", hint: "Science" },
    { value: 3, label: "Carla Lim", hint: "English" },
  ];

  it("filters as the user types, and says when nothing matches", () => {
    const select = searchableSelect({ label: "Teacher", options });
    document.body.append(select);
    select.querySelector("button").click();
    const search = select.querySelector("input");

    type(search, "ben");
    expect([...select.querySelectorAll("[role=option]")].map((item) => item.textContent)).toEqual(["Ben CruzScience"]);

    type(search, "science");
    expect(select.querySelectorAll("[role=option]")).toHaveLength(1);

    type(search, "zzz");
    expect(select.textContent).toContain("No results");
  });

  it("chooses with the keyboard", () => {
    const onChange = vi.fn();
    const select = searchableSelect({ label: "Teacher", options, onChange });
    document.body.append(select);
    select.querySelector("button").click();
    const search = select.querySelector("input");

    key(search, "ArrowDown");
    key(search, "Enter");

    expect(onChange).toHaveBeenCalledWith(2, options[1]);
    expect(select.getValue()).toBe(2);
    expect(select.querySelector("button").textContent).toContain("Ben Cruz");
  });

  it("offers to add what was typed, for a new teacher", async () => {
    const run = vi.fn();
    const select = searchableSelect({ label: "Teacher", options, create: { label: (typed) => `Add new teacher "${typed}"`, run } });
    document.body.append(select);
    select.querySelector("button").click();
    type(select.querySelector("input"), "Dina Santos");

    const add = [...select.querySelectorAll("[role=option]")].find((item) => item.textContent.includes("Add new teacher"));
    expect(add?.textContent).toContain('Add new teacher "Dina Santos"');
    add.click();
    await Promise.resolve();
    expect(run).toHaveBeenCalledWith("Dina Santos");
  });

  it("is labelled for screen readers", () => {
    const select = searchableSelect({ label: "Room", options });
    document.body.append(select);
    const label = select.querySelector("label");
    expect(label.textContent).toBe("Room");
    expect(document.getElementById(label.htmlFor)).toBe(select.querySelector("button"));
  });
});

describe("12-hour time picker (UI requirement 5)", () => {
  it("gives 24-hour time to the API from a typed 12-hour time", () => {
    const picker = timePicker({ label: "Start time" });
    document.body.append(picker);
    picker.querySelector("input").value = "1:30";
    [...picker.querySelectorAll("button")].find((button) => button.textContent === "PM").click();

    expect(picker.getValue()).toBe("13:30");
  });

  it("shows a 24-hour value as 12-hour", () => {
    const picker = timePicker({ label: "End time", value: "14:05" });
    expect(picker.querySelector("input").value).toBe("2:05");
    expect([...picker.querySelectorAll("button")].find((button) => button.textContent === "PM").getAttribute("aria-pressed")).toBe("true");
  });

  it("says what is wrong with a time that is not one", () => {
    const picker = timePicker({ label: "Start time" });
    document.body.append(picker);
    picker.querySelector("input").value = "13:00";

    expect(picker.validate()).toBe(false);
    expect(picker.textContent).toContain("hour 1 to 12");
  });
});

describe("centered dialog (UI requirement 2) and confirmations", () => {
  it("opens with a title and closes with its button", () => {
    const onClose = vi.fn();
    const { element } = openDialog({ title: "Add class", body: "Fields", onClose });

    expect(element.open).toBe(true);
    expect(element.querySelector("h2").textContent).toBe("Add class");
    [...element.querySelectorAll("button")].find((button) => button.textContent.includes("Close")).click();
    expect(onClose).toHaveBeenCalled();
    expect(document.body.contains(element)).toBe(false);
  });

  it("asks before something that cannot be undone", async () => {
    const answer = confirmAction({ title: "Clear this schedule?", message: "This removes all 12 classes.", confirmLabel: "Yes, clear it" });
    const dialog = document.querySelector("dialog");
    expect(dialog.textContent).toContain("This removes all 12 classes.");
    [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Yes, clear it").click();

    await expect(answer).resolves.toBe(true);
  });

  it("resolves false on Cancel", async () => {
    const answer = confirmAction({ title: "Remove?", message: "Gone.", confirmLabel: "Remove" });
    [...document.querySelector("dialog").querySelectorAll("button")].find((button) => button.textContent === "Cancel").click();
    await expect(answer).resolves.toBe(false);
  });
});

describe("pop-up notifications (UI requirement 4)", () => {
  it("shows success and the API's own error message", () => {
    toast.success("Math 7 was added.");
    toast.error(new ApiError(422, "Ana Reyes is teaching Grade 7 – Hope on Monday at 7:00 AM."));

    const area = document.getElementById("toasts");
    expect(area.querySelector("[role=status]").textContent).toContain("Math 7 was added.");
    expect(area.querySelector("[role=alert]").textContent).toContain("Ana Reyes is teaching");
    // Each says plainly how it went; the newest is on top.
    expect(area.firstElementChild.textContent).toContain("Failed");
    expect(area.querySelector("[role=status]").textContent).toContain("Success");
  });

  it("keeps a message shown inside a dialog on screen when the dialog closes", () => {
    const { element, close } = openDialog({ title: "Add class", body: "Fields" });
    // In a browser, a message shown while a dialog is open goes inside it (outside is inert).
    element.append(document.getElementById("toasts"));
    toast.success("Values Education was added.");
    close();

    const area = document.getElementById("toasts");
    expect(area?.parentElement).toBe(document.body);
    expect(area?.textContent).toContain("Values Education was added.");
  });
});

describe("list editor (tracks, departments, designations, tasks)", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("lists the names, adds one and deletes one after confirming", async () => {
    let items = [{ id: 1, name: "Academic" }];
    const add = vi.fn(async (name) => { items = [...items, { id: 2, name }]; });
    const remove = vi.fn(async (item) => { items = items.filter((other) => other.id !== item.id); });
    openListEditor({ title: "Tracks", load: async () => [{ label: "Tracks", noun: "track", items, add, remove }] });
    await settle();
    const dialog = document.querySelector("dialog");
    expect(dialog.textContent).toContain("Academic");

    dialog.querySelector("input").value = "TechPro";
    dialog.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true }));
    await settle();
    await settle();
    expect(add).toHaveBeenCalledWith("TechPro");
    expect(dialog.textContent).toContain("TechPro");

    dialog.querySelector('[aria-label="Delete Academic"]').click();
    await settle();
    const confirm = [...document.querySelectorAll("dialog")].at(-1);
    [...confirm.querySelectorAll("button")].find((button) => button.textContent === "Delete").click();
    await settle();
    await settle();
    expect(remove).toHaveBeenCalledWith({ id: 1, name: "Academic" });
    expect(dialog.textContent).not.toContain("Academic");
  });

  it("hides Delete when the user may not delete, and says who can", async () => {
    openListEditor({ title: "Tracks", load: async () => [{ label: "Tracks", noun: "track", items: [{ id: 1, name: "Academic" }], add: async () => {}, note: "Only the Admin can delete a track." }] });
    await settle();
    const dialog = [...document.querySelectorAll("dialog")].at(-1);
    expect(dialog.querySelector('[aria-label="Delete Academic"]')).toBeNull();
    expect(dialog.textContent).toContain("Only the Admin can delete a track.");
  });
});
