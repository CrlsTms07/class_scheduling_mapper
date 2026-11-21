// @ts-check
/**
 * Step 2 of the setup: Subjects of this school year, names only (beneficiary review, Nov 21, 2026:
 * no grade and no typed minutes; optional term and track for Senior High), and Activities such as
 * Flag Ceremony. Subjects belong to one school year, so
 * a new curriculum never changes past schedules.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { dataList, editButton } from "@/components/data-list.js";
import { openFormDialog } from "@/components/form-dialog.js";
import { openListEditor } from "@/components/list-editor.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, noMatches, pageHeader } from "@/components/page-header.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { watch } from "@/state/cache.js";
import { session } from "@/state/session.js";
import { termState } from "@/state/term.js";

const TYPES = { core: "Core", elective: "Elective", other: "Other" };

/** @type {import("@/router.js").RenderPage} */
export async function render(container) {
  const year = termState.term?.school_year;
  if (!year) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "Start a school year first, on the School Years page." })));
    return;
  }
  const isAdmin = session.user?.role === "super_admin";
  const ui = { search: "", term: "" };
  const content = h("div", { class: "space-y-5" }, skeletonList(4));
  /** @type {any} */
  let options = { grade_levels: [], tracks: [], terms: [] };

  const termName = (/** @type {number | null} */ termNo) => (termNo === null ? "Whole year" : options.terms.find((/** @type {any} */ term) => term.term_no === termNo)?.name ?? `${year.term_label} ${termNo}`);

  const subjectForm = async (/** @type {any} */ subject = null) => {
    // The choices are loaded first, so a quick tap never opens an empty form.
    options = await getRecords(`/school-years/${year.id}/subject-options`);
    // Names already used this school year (any grade), to pick from; a new name can still be typed.
    const known = (await getRecords(`/school-years/${year.id}/subjects`)).map((/** @type {any} */ item) => String(item.name));
    const names = [...new Set([...known, ...(subject ? [subject.name] : [])])].sort((a, b) => a.localeCompare(b));
    openFormDialog({
      title: subject ? `Edit ${subject.name}` : "Add a subject",
      description: subject?.locked_reason ? `${subject.locked_reason} Its track and time of the year can no longer change.` : `For SY ${year.name}. Just the subject: add it to each section, with its teacher, in Teacher Loading. The minutes are counted from the schedule.`,
      fields: [
        { name: "name", label: "Subject name", type: "select", required: true, value: subject?.name ?? "", options: names.map((name) => ({ value: name, label: name })), localCreate: true, onCreate: async (typed) => ({ value: typed.trim(), label: typed.trim() }), help: "Pick a subject already in the list, or type a new name and choose Use." },
        { name: "code", label: "Code", value: subject?.code ?? "" },
        { name: "term_no", label: `Taken in which ${year.term_label.toLowerCase()}`, type: "select", value: subject?.term_no ?? "", disabled: !!subject?.locked_reason, options: [{ value: "", label: "Whole year" }, ...options.terms.map((/** @type {any} */ term) => ({ value: term.term_no, label: term.name }))] },
        { name: "track_id", label: "Track (Senior High)", type: "select", value: subject?.track_id ?? "", disabled: !!subject?.locked_reason, options: [{ value: "", label: "All tracks" }, ...options.tracks.map((/** @type {any} */ track) => ({ value: track.id, label: track.name }))] },
        { name: "subject_type", label: "Type (Senior High)", type: "select", required: true, value: subject?.subject_type ?? "core", options: Object.entries(TYPES).map(([value, label]) => ({ value, label })) },
        { name: "is_priority", label: "Priority (placed first, like PE and Homeroom)", type: "checkbox", value: subject?.is_priority ?? false },
        { name: "is_active", label: "Offered this school year", type: "checkbox", value: subject?.is_active ?? true },
      ],
      submitLabel: subject ? "Save changes" : "Add subject",
      onSubmit: async (values) => {
        // No grade and no minutes (beneficiary review, Nov 21, 2026): the grade comes from the
        // section in Teacher Loading, and the minutes from the schedule.
        const body = {
          track_id: values.track_id ? Number(values.track_id) : null,
          term_no: values.term_no === "" || values.term_no === null ? null : Number(values.term_no),
          code: values.code || null,
          name: values.name,
          subject_type: values.subject_type,
          is_priority: values.is_priority,
          is_active: values.is_active,
        };
        await changeRecord(subject ? `/subjects/${subject.id}` : `/school-years/${year.id}/subjects`, subject ? "PUT" : "POST", body);
        return `${values.name} was ${subject ? "saved" : "added"}.`;
      },
      remove: subject ? { label: "Delete this subject", message: `This deletes ${subject.name} from SY ${year.name}.`, blockedReason: subject.locked_reason, run: async () => { await changeRecord(`/subjects/${subject.id}`, "DELETE"); return `${subject.name} was deleted.`; } } : undefined,
    });
  };

  // Senior High tracks, shared by every school year. Only the Admin deletes one, and only when no
  // section or subject uses it (the server says which).
  const editTracks = () =>
    openListEditor({
      title: "Tracks",
      description: "Senior High tracks, like Academic or TechPro. Tracks are kept from year to year.",
      load: async () => {
        const loaded = await getRecords(`/school-years/${year.id}/subject-options`);
        return [{
          label: "Tracks",
          noun: "track",
          items: loaded.tracks,
          add: (name) => changeRecord("/tracks", "POST", { name }),
          remove: isAdmin ? (track) => changeRecord(`/tracks/${track.id}`, "DELETE") : undefined,
          note: isAdmin ? undefined : "Only the Admin can delete a track.",
        }];
      },
    });

  const activityForm = (/** @type {any} */ activity = null) =>
    openFormDialog({
      title: activity ? `Edit ${activity.name}` : "Add an activity",
      description: "Flag Ceremony, Catch-up Friday and the like. On the schedule, choose Activity on a period.",
      fields: [
        { name: "name", label: "Name", required: true, value: activity?.name },
        { name: "code", label: "Short code", value: activity?.code ?? "", help: "Like FLAG" },
        ...(isAdmin ? [{ name: "department", label: "Department", type: /** @type {const} */ ("select"), value: activity?.department ?? "", options: [{ value: "", label: "School-wide" }, { value: "JHS", label: "Junior High" }, { value: "SHS", label: "Senior High" }] }] : []),
      ],
      submitLabel: activity ? "Save changes" : "Add activity",
      onSubmit: async (values) => {
        const body = { name: values.name, code: values.code || null, ...(isAdmin ? { department: values.department || null } : {}) };
        await changeRecord(activity ? `/activities/${activity.id}` : `/school-years/${year.id}/activities`, activity ? "PUT" : "POST", body);
        return `${values.name} was ${activity ? "saved" : "added"}.`;
      },
      remove: activity ? { label: "Delete this activity", message: `This deletes ${activity.name}.`, blockedReason: activity.in_use ? "It is on a schedule." : null, run: async () => { await changeRecord(`/activities/${activity.id}`, "DELETE"); return `${activity.name} was deleted.`; } } : undefined,
    });

  const searchInput = /** @type {HTMLInputElement} */ (h("input", { type: "search", class: "input", placeholder: "Name, code or track", "aria-label": "Search subjects", oninput: () => { ui.search = searchInput.value; draw(); } }));

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "book", title: "Subjects", description: `Step 2 of the setup: the subjects of SY ${year.name}, names only. Add each to its sections in Teacher Loading.`, crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Subjects" }], actions: [h("button", { type: "button", class: "btn btn-outline", onclick: editTracks }, icon("layers"), "Tracks"), h("button", { type: "button", class: "btn btn-primary", onclick: () => subjectForm() }, icon("plus"), "Add subject")] }),
      content,
    ),
  );

  const draw = async () => {
    try {
      const [subjects, activities] = await Promise.all([getRecords(`/school-years/${year.id}/subjects`), getRecords(`/school-years/${year.id}/activities`)]);
      options = await getRecords(`/school-years/${year.id}/subject-options`);
      const words = ui.search.trim().toLowerCase();
      const shown = subjects.filter((/** @type {any} */ subject) => (ui.term === "" || String(subject.term_no ?? "year") === ui.term) && (!words || `${subject.name} ${subject.code ?? ""} ${subject.track ?? ""}`.toLowerCase().includes(words)));

      replace(
        content,
        h(
          "div",
          { class: "card grid gap-3 p-3 sm:grid-cols-2" },
          h("div", { class: "space-y-1" }, h("label", { class: "field-label" }, "Search"), searchInput),
          searchableSelect({ label: "When", value: ui.term, options: [{ value: "", label: "Any time" }, { value: "year", label: "Whole year" }, ...options.terms.map((/** @type {any} */ term) => ({ value: String(term.term_no), label: term.name }))], onChange: (value) => { ui.term = String(value); draw(); } }),
        ),
        subjects.length === 0
          ? emptyState({ title: "No subjects yet", text: `Add the subjects of SY ${year.name}: just their names. Then add each to its sections in Teacher Loading.`, action: h("button", { type: "button", class: "btn btn-primary", onclick: () => subjectForm() }, icon("plus"), "Add subject") })
          : shown.length === 0
            ? noMatches({
                noun: "subject",
                search: ui.search,
                filters: [ui.term === "year" ? "Whole year" : ui.term ? termName(Number(ui.term)) : null],
                onClear: () => {
                  Object.assign(ui, { search: "", term: "" });
                  searchInput.value = "";
                  draw();
                },
              })
            : dataList({
                label: "Subjects",
                items: shown,
                columns: [
                  { label: "Subject", primary: true, cell: (/** @type {any} */ subject) => h("span", null, subject.name, subject.is_priority ? h("span", { class: "badge ml-2 bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100" }, "Priority") : null, subject.is_active ? null : h("span", { class: "badge ml-2 bg-surface-muted" }, "Not offered")) },
                  { label: "Grade", cell: (/** @type {any} */ subject) => (subject.grade ? `Grade ${subject.grade} only` : "Any grade") },
                  { label: "When", cell: (/** @type {any} */ subject) => termName(subject.term_no) },
                  { label: "Track", cell: (/** @type {any} */ subject) => subject.track ?? "–" },
                  { label: "Type", cell: (/** @type {any} */ subject) => TYPES[/** @type {keyof typeof TYPES} */ (subject.subject_type)] },
                ],
                actions: (/** @type {any} */ subject) => editButton(subject.name, () => subjectForm(subject)),
              }),
        h(
          "section",
          { "aria-label": "Activities", class: "card space-y-3 p-4" },
          h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between" }, h("div", null, h("h2", { class: "font-semibold text-accent" }, "Activities"), h("p", { class: "text-small text-muted-foreground" }, "Flag Ceremony, Catch-up Friday and the like. On the schedule, choose Activity on a period, then apply it to one section, a grade level or all sections.")), h("button", { type: "button", class: "btn btn-outline", onclick: () => activityForm() }, icon("plus"), "Add activity")),
          activities.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "No activities yet.") : h("ul", { class: "flex flex-wrap gap-2" }, activities.map((/** @type {any} */ activity) => h("li", { class: "flex items-center gap-2 rounded-lg border bg-surface-muted px-3 py-1 text-sm" }, h("span", { class: "font-medium" }, activity.name), activity.code ? h("span", { class: "text-small text-muted-foreground" }, activity.code) : null, h("span", { class: "badge bg-surface" }, activity.department ? { JHS: "Junior High", SHS: "Senior High" }[/** @type {"JHS" | "SHS"} */ (activity.department)] : "School-wide"), activity.can_edit === false ? null : editButton(activity.name, () => activityForm(activity))))),
        ),
      );
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };

  const stop = watch(["records"], draw);
  await draw();
  return stop;
}
