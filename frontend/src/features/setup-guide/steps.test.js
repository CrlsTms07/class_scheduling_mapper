// @ts-check
import { describe, expect, it } from "vitest";
import { buildSetupSteps } from "./steps.js";

const checklist = (/** @type {Record<string, boolean>} */ done = {}) =>
  ["calendar", "school_profile", "time_slots", "sections", "signatories", "schedulers"].map((key) => ({ key, done: !!done[key], detail: `${key} detail` }));

const steps = (/** @type {Record<string, boolean>} */ done = {}, teachers = 0) => [
  { key: "rooms", done: !!done.rooms, counts: { rooms: 3, buildings: 1 } },
  { key: "bell", done: false, counts: {} },
  { key: "subjects", done: false, counts: {} },
  { key: "teachers", done: teachers > 0, counts: { teachers } },
  { key: "loading", done: !!done.loading, counts: { loaded: 2, needed: 10 } },
  { key: "plot", done: false, counts: { sections: 4, started: 1, submitted: 0 } },
];

describe("Setup Guide steps", () => {
  it("lists the steps in order, with Teacher Loading before making schedules", () => {
    const list = buildSetupSteps({ checklist: checklist(), steps: steps(), departments: 0, tracks: 0, subjects: 0, termLabel: "Term", hasOtherTerms: false });
    expect(list.map(({ number, title }) => `${number}. ${title}`)).toEqual([
      "1. School Year & Terms", "2. Departments & Tracks", "3. Bell Schedules", "4. Teachers", "5. Subjects",
      "6. Buildings & Rooms", "7. Sections & Advisers", "8. Teacher Loading", "9. Report Settings", "10. Make the Schedules",
    ]);
  });

  it("disables a step whose prerequisite is missing, and says which step to do first", () => {
    const list = buildSetupSteps({ checklist: checklist({ calendar: true }), steps: steps(), departments: 2, tracks: 0, subjects: 5, termLabel: "Semester", hasOtherTerms: true });
    const byKey = Object.fromEntries(list.map((step) => [step.key, step]));

    expect(byKey.teachers.blockedBy).toBeNull();
    expect(byKey.sections.blockedBy).toBe("Add teachers first (Step 4).");
    expect(byKey.loading.blockedBy).toBe("Add teachers first (Step 4).");
    expect(byKey.schedules.blockedBy).toBe("Set up the bell schedules first (Step 3).");
    expect(byKey.lists.status).toBe("2 departments · 0 tracks");
    expect(byKey.schedules.actions.map(({ label }) => label)).toContain("Copy from another semester");
  });

  it("asks for departments before teachers, since every teacher belongs to one", () => {
    const list = buildSetupSteps({ checklist: checklist({ calendar: true }), steps: steps({}, 3), departments: 0, tracks: 0, subjects: 0, termLabel: "Term", hasOtherTerms: false });
    const teachers = list.find((step) => step.key === "teachers");
    expect(teachers?.done).toBe(true);
    expect(teachers?.blockedBy).toBe("Add the departments first (Step 2).");
    expect(list.find((step) => step.key === "schedules")?.actions.some((action) => action.copy)).toBe(false);
  });
});
