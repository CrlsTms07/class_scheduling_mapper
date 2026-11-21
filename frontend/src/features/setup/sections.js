// @ts-check
/**
 * Step 3 of the setup: Sections of this school year, each with its grade, track (Senior High),
 * shift, adviser (one advisory per teacher a year), co-adviser, home room and class size.
 * A Chairperson or Master Teacher encodes the sections of their own grade levels.
 */
import { defaultShift, shiftOptions } from "@/lib/shifts.js";
import { session } from "@/state/session.js";
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { dataList, editButton } from "@/components/data-list.js";
import { openFormDialog } from "@/components/form-dialog.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, noMatches, pageHeader } from "@/components/page-header.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { watch } from "@/state/cache.js";
import { termState } from "@/state/term.js";

const SHIFTS = { WHOLE_DAY: "Whole day", AM: "Morning (AM)", PM: "Afternoon (PM)" };

/** @type {import("@/router.js").RenderPage} */
export async function render(container, { query }) {
  const year = termState.term?.school_year;
  if (!year) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "Start a school year first, on the School Years page." })));
    return;
  }
  const ui = { search: "", grade: "" };
  const content = h("div", { class: "space-y-5" }, skeletonList(4));
  /** @type {any} */
  let options = { grade_levels: [], tracks: [], teachers: [], rooms: [] };

  /** This year's sections, to say at once when a name is taken. */
  /** @type {any[]} */
  let knownSections = [];
  const sectionForm = async (/** @type {any} */ section = null) => {
    // The choices are loaded first, so a quick tap never opens an empty form.
    options = await getRecords(`/school-years/${year.id}/section-options`);
    const teacherOptions = (/** @type {"adviser" | "co"} */ kind) => [
      { value: "", label: kind === "adviser" ? "No adviser yet" : "No co-adviser" },
      ...options.teachers.map((/** @type {any} */ teacher) => ({
        value: teacher.id,
        label: teacher.name,
        hint: teacher.advises && teacher.advises_section_id !== section?.id ? `Already adviser of ${teacher.advises}` : undefined,
      })),
    ];
    // A Chairperson (Junior High) never sees Senior High fields, and the Master Teacher (Senior High)
    // never sees Junior High ones; the Admin sees both (team decision, Nov 21, 2026).
    const levels = new Set(options.grade_levels.map((/** @type {any} */ grade) => grade.level));
    const hasShs = levels.has("SHS");
    const hasJhs = levels.has("JHS");
    const levelOf = (/** @type {any} */ gradeId) => options.grade_levels.find((/** @type {any} */ grade) => String(grade.id) === String(gradeId))?.level;
    const roomLabel = hasJhs && hasShs ? "Home room (Junior High) or usual room (Senior High)" : hasShs ? "Usual room" : "Home room";
    const roomHelp = hasJhs && hasShs ? "Its classes take this room unless another is chosen." : hasShs ? "Senior High classes may use other rooms; this is the one they take unless another is chosen." : "The section's fixed room: its classes are held here.";
    openFormDialog({
      title: section ? `Edit ${section.label}` : "Add a section",
      description: section?.locked_reason ? `${section.locked_reason} The grade and shift can no longer change.` : `For SY ${year.name}. Sections are encoded again each school year.`,
      fields: [
        { name: "name", label: "Section name", required: true, value: section?.name, help: "Like Honesty or STEM 11-1", check: (value, values) => (knownSections.some((/** @type {any} */ other) => other.id !== section?.id && String(other.grade_level_id) === String(values.grade_level_id) && other.name.trim().toLowerCase() === String(value).trim().toLowerCase()) ? "This grade level already has a section with this name." : null) },
        { name: "grade_level_id", label: "Grade level", type: "select", required: true, value: section?.grade_level_id ?? "", disabled: !!section?.locked_reason, options: options.grade_levels.map((/** @type {any} */ grade) => ({ value: grade.id, label: `Grade ${grade.grade}` })) },
        { name: "shift", label: "Shift", type: "select", required: true, value: section?.shift ?? defaultShift(session.user?.role), disabled: !!section?.locked_reason, options: shiftOptions(session.user?.role, section?.shift) },
        ...(hasShs ? [{ name: "track_id", label: "Track", type: /** @type {const} */ ("select"), help: "For Senior High only, like Academic or TechPro.", check: (/** @type {any} */ value, /** @type {any} */ values) => (value && levelOf(values.grade_level_id) === "JHS" ? "Only Senior High sections have a track. Choose No track." : null), value: section?.track_id ?? "", options: [{ value: "", label: "No track" }, ...options.tracks.map((/** @type {any} */ track) => ({ value: track.id, label: track.name }))] }] : []),
        ...(hasShs ? [{ name: "strand", label: "Strand", value: section?.strand ?? "", help: "For Senior High only, like Arts, Social Science and Humanities. Printed after the track.", check: (/** @type {any} */ value, /** @type {any} */ values) => (String(value ?? "").trim() && levelOf(values.grade_level_id) === "JHS" ? "Only Senior High sections have a strand. Leave it empty." : String(value ?? "").length > 120 ? "Use at most 120 characters." : null) }] : []),
        { name: "adviser_id", label: "Adviser", type: "select", value: section?.adviser_id ?? "", options: teacherOptions("adviser"), help: "A teacher advises one section a year.", check: (value, values) => (value && value === values.co_adviser_id ? "The adviser and co-adviser must be different people." : null) },
        { name: "co_adviser_id", label: "Co-adviser", type: "select", value: section?.co_adviser_id ?? "", options: teacherOptions("co") },
        { name: "home_room_id", label: roomLabel, type: "select", value: section?.home_room_id ?? "", options: [{ value: "", label: "No room yet" }, ...options.rooms.map((/** @type {any} */ room) => ({ value: room.id, label: room.label }))], help: roomHelp },
        { name: "class_size", label: "Class size", type: "number", min: 1, max: 100, value: section?.class_size },
      ],
      submitLabel: section ? "Save changes" : "Add section",
      onSubmit: async (values) => {
        const id = (/** @type {any} */ value) => (value === "" || value === null ? null : Number(value));
        const body = { name: values.name, grade_level_id: Number(values.grade_level_id), shift: values.shift, track_id: hasShs ? id(values.track_id) : null, strand: hasShs && values.strand?.trim() ? values.strand.trim() : null, adviser_id: id(values.adviser_id), co_adviser_id: id(values.co_adviser_id), home_room_id: id(values.home_room_id), class_size: values.class_size ?? null };
        await changeRecord(section ? `/sections/${section.id}` : `/school-years/${year.id}/sections`, section ? "PUT" : "POST", body);
        return `${values.name} was ${section ? "saved" : "added"}.`;
      },
      remove: section ? { label: "Delete this section", message: `This deletes ${section.label} with its teacher loading.`, blockedReason: section.locked_reason, run: async () => { await changeRecord(`/sections/${section.id}`, "DELETE"); return `${section.label} was deleted.`; } } : undefined,
    });
  };

  const searchInput = /** @type {HTMLInputElement} */ (h("input", { type: "search", class: "input", placeholder: "Section, adviser or room", "aria-label": "Search sections", oninput: () => { ui.search = searchInput.value; draw(); } }));

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "team", title: "Sections", description: `Step 3 of the setup: the sections of SY ${year.name}, with their advisers and rooms.`, crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Sections" }], actions: [h("a", { href: "/reports?tab=advisers", class: "btn btn-outline" }, icon("folder"), "Adviser summary"), h("button", { type: "button", class: "btn btn-primary", onclick: () => sectionForm() }, icon("plus"), "Add section")] }),
      content,
    ),
  );

  const draw = async () => {
    try {
      const [sections, loaded] = await Promise.all([getRecords(`/school-years/${year.id}/sections`), getRecords(`/school-years/${year.id}/section-options`)]);
      knownSections = sections;
      options = loaded;
      const words = ui.search.trim().toLowerCase();
      const grades = [...new Set(sections.map((/** @type {any} */ section) => section.grade))].sort((a, b) => a - b);
      const shown = sections.filter((/** @type {any} */ section) => (!ui.grade || section.grade === Number(ui.grade)) && (!words || `${section.label} ${section.adviser ?? ""} ${section.co_adviser ?? ""} ${section.home_room ?? ""}`.toLowerCase().includes(words)));
      replace(
        content,
        h("div", { class: "card grid gap-3 p-3 sm:grid-cols-2" }, h("div", { class: "space-y-1" }, h("label", { class: "field-label" }, "Search"), searchInput), searchableSelect({ label: "Grade level", value: ui.grade, options: [{ value: "", label: "All grades" }, ...grades.map((grade) => ({ value: String(grade), label: `Grade ${grade}` }))], onChange: (value) => { ui.grade = String(value); draw(); } })),
        sections.length === 0
          ? emptyState({ title: "No sections yet", text: "Add your first section. A schedule is made for each one.", action: h("button", { type: "button", class: "btn btn-primary", onclick: () => sectionForm() }, icon("plus"), "Add section") })
          : shown.length === 0
            ? noMatches({
                noun: "section",
                search: ui.search,
                filters: [ui.grade ? `Grade ${ui.grade}` : null],
                onClear: () => {
                  Object.assign(ui, { search: "", grade: "" });
                  searchInput.value = "";
                  draw();
                },
              })
            : dataList({
                label: "Sections",
                items: shown,
                columns: [
                  { label: "Section", primary: true, cell: (/** @type {any} */ section) => section.label },
                  ...(options.grade_levels.some((/** @type {any} */ grade) => grade.level === "SHS") ? [{ label: "Track (SHS)", cell: (/** @type {any} */ section) => section.track ?? "–" }] : []),
                  { label: "Shift", cell: (/** @type {any} */ section) => SHIFTS[/** @type {keyof typeof SHIFTS} */ (section.shift)] },
                  { label: "Adviser", cell: (/** @type {any} */ section) => section.adviser ?? h("span", { class: "text-warning" }, "None yet") },
                  { label: "Co-adviser", cell: (/** @type {any} */ section) => section.co_adviser ?? "–" },
                  { label: "Room", cell: (/** @type {any} */ section) => section.home_room ?? "No room yet" },
                  { label: "Size", cell: (/** @type {any} */ section) => (section.class_size ? String(section.class_size) : "–") },
                ],
                actions: (/** @type {any} */ section) => [editButton(section.label, () => sectionForm(section)), h("a", { href: `/schedule/sections/${section.id}`, class: "btn btn-quiet" }, "Schedule")],
              }),
      );
      if (query.get("add") === "1" && !content.dataset.opened) {
        content.dataset.opened = "1";
        sectionForm();
      }
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };

  const stop = watch(["records"], draw);
  await draw();
  return stop;
}
