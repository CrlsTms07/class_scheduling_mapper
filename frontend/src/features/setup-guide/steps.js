// @ts-check
/**
 * The Setup Guide's steps, worked out from what the dashboards and lists say. Pure (no screen code),
 * so it is easy to test and to explain: each step has its status, its count, and what it needs first.
 */

/**
 * @typedef {import("@/api/imports.js").ImportType} ImportType
 * @typedef {{ label: string, to?: string, importType?: ImportType, copy?: boolean, primary?: boolean }} StepAction
 * @typedef {Object} SetupStep
 * @property {number} number
 * @property {string} key
 * @property {string} title
 * @property {string} detail
 * @property {boolean} done
 * @property {string} status
 * @property {string | null} blockedBy  why it cannot be done yet, e.g. "Add teachers first (Step 4)."
 * @property {boolean} [later]  can wait (only needed for printing)
 * @property {StepAction[]} actions
 */

/** @param {number} count @param {string} word @param {string} [many] */
const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

/**
 * The steps in order, from what the dashboards and lists say.
 * @param {{ checklist: any[], steps: any[], departments: number, tracks: number, subjects: number, termLabel: string, hasOtherTerms: boolean }} data
 * @returns {SetupStep[]}
 */
export function buildSetupSteps({ checklist, steps, departments, tracks, subjects, termLabel, hasOtherTerms }) {
  const item = (/** @type {string} */ key) => checklist.find((entry) => entry.key === key) ?? { done: false, detail: "" };
  const step = (/** @type {string} */ key) => steps.find((entry) => entry.key === key) ?? { done: false, counts: {} };

  const rooms = step("rooms").counts;
  const teachers = step("teachers").counts.teachers ?? 0;
  const loading = step("loading").counts;
  const plot = step("plot").counts;
  const sections = item("sections");
  const word = termLabel.toLowerCase();

  /** @type {Omit<SetupStep, "number" | "blockedBy">[]} */
  const list = [
    { key: "calendar", title: "School Year & Terms", detail: `An active school year with its ${word}s and dates.`, done: item("calendar").done, status: item("calendar").detail, actions: [{ label: "School Years", to: "/school-years" }] },
    { key: "lists", title: "Departments & Tracks", detail: "The departments teachers belong to (Teachers page, Edit lists) and the Senior High tracks (Subjects page, Tracks).", done: departments > 0, status: `${plural(departments, "department")} · ${plural(tracks, "track")}`, actions: [{ label: "Departments", to: "/teachers" }, { label: "Tracks", to: "/subjects" }] },
    { key: "bell", title: "Bell Schedules", detail: "The periods and breaks of each department, like Monday – Thursday and Friday.", done: item("time_slots").done, status: item("time_slots").detail, actions: [{ label: "Time Slots", to: "/time-slots" }] },
    { key: "teachers", title: "Teachers", detail: "Teaching personnel by employee ID, each in a department.", done: teachers > 0, status: plural(teachers, "active teacher"), actions: [{ label: "Import teachers", importType: "teachers", primary: true }, { label: "Teachers page", to: "/teachers" }] },
    { key: "subjects", title: "Subjects", detail: "The subjects of each grade level this school year, with their minutes per week.", done: subjects > 0, status: plural(subjects, "subject"), actions: [{ label: "Import subjects", importType: "subjects", primary: true }, { label: "Subjects page", to: "/subjects" }] },
    { key: "rooms", title: "Buildings & Rooms", detail: "The buildings and rooms classes are held in.", done: step("rooms").done, status: `${plural(rooms.buildings ?? 0, "building")} · ${plural(rooms.rooms ?? 0, "room")}`, actions: [{ label: "Import rooms", importType: "rooms", primary: true }, { label: "Rooms & Buildings", to: "/buildings" }] },
    { key: "sections", title: "Sections & Advisers", detail: "This year's sections with their adviser, co-adviser and track.", done: sections.done, status: sections.detail, actions: [{ label: "Import sections", importType: "sections", primary: true }, { label: "Sections page", to: "/sections" }] },
    { key: "loading", title: "Teacher Loading", detail: `Who teaches each subject of each section this ${word}.`, done: step("loading").done, status: `${loading.loaded ?? 0} of ${loading.needed ?? 0} subjects have a teacher`, actions: [{ label: "Teacher Loading", to: "/teacher-loading" }] },
    { key: "printing", title: "Report Settings", detail: "The school profile and the signatories of the printed forms. Only needed for printing.", done: item("signatories").done && item("school_profile").done, status: item("signatories").detail, later: true, actions: [{ label: "Report Settings", to: "/report-settings" }] },
    {
      key: "schedules",
      title: "Make the Schedules",
      detail: `Plot each section, or copy another ${word}'s schedule. Then Submit → Approve → Print.`,
      done: step("plot").done,
      status: `${plot.started ?? 0} of ${plot.sections ?? 0} sections started · ${plot.submitted ?? 0} submitted`,
      actions: [{ label: "Open the Schedule", to: "/schedule", primary: true }, ...(hasOtherTerms ? [{ label: `Copy from another ${word}`, copy: true }] : []), { label: "Approvals", to: "/approvals" }, { label: "Reports", to: "/reports" }],
    },
  ];

  /** What each step needs first, and how to say it. */
  const needs = /** @type {Record<string, string[]>} */ ({ bell: ["calendar"], teachers: ["lists"], subjects: ["calendar"], sections: ["calendar", "teachers"], loading: ["teachers", "subjects", "sections"], printing: ["calendar"], schedules: ["bell", "teachers", "subjects", "rooms", "sections", "loading"] });
  const firstWords = /** @type {Record<string, string>} */ ({ calendar: "Start the school year", lists: "Add the departments", bell: "Set up the bell schedules", teachers: "Add teachers", subjects: "Add subjects", rooms: "Add rooms", sections: "Add sections", loading: "Give each subject a teacher" });

  return list.map((entry, index) => {
    const missing = (needs[entry.key] ?? []).map((key) => list.findIndex((other) => other.key === key)).find((at) => at >= 0 && !list[at].done);
    return { ...entry, number: index + 1, blockedBy: missing === undefined ? null : `${firstWords[list[missing].key]} first (Step ${missing + 1}).` };
  });
}
