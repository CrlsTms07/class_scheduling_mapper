// @ts-check
/**
 * Step 2 of the setup: Subjects of this school year, names only (beneficiary review, Nov 21, 2026:
 * no grade and no typed minutes), with Class Hours as the second tab of the same step. The Senior
 * High details (term, track, type) and the Tracks list are the Admin's only; a Chairperson or Master
 * Teacher just lists names. Activities are chosen or typed in the class form while plotting.
 * Subjects belong to one school year, so a new curriculum never changes past schedules.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { dataList, editButton } from "@/components/data-list.js";
import { openFormDialog } from "@/components/form-dialog.js";
import { openListEditor } from "@/components/list-editor.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, noMatches, pageHeader } from "@/components/page-header.js";
import { confirmAction } from "@/components/dialog.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { watch } from "@/state/cache.js";
import { session } from "@/state/session.js";
import { termState } from "@/state/term.js";
import { subjectTabs } from "./subject-tabs.js";

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
    const others = (await getRecords(`/school-years/${year.id}/subjects`)).filter((/** @type {any} */ item) => item.id !== subject?.id);
    /** The same name for the same time of the year and track is a repeat: said while typing. */
    const repeatOf = (/** @type {string} */ name, /** @type {Record<string, any>} */ values) => {
      const key = (name ?? "").trim().toLowerCase();
      const termNo = isAdmin ? (values.term_no === "year" ? null : Number(values.term_no)) : null;
      const trackId = isAdmin && values.track_id ? Number(values.track_id) : null;
      return key ? others.find((/** @type {any} */ item) => item.name.trim().toLowerCase() === key && item.term_no === termNo && (item.track_id ?? null) === trackId) : undefined;
    };
    openFormDialog({
      title: subject ? `Edit ${subject.name}` : "Add a subject",
      description: subject?.locked_reason ? `${subject.locked_reason} Its time of the year and track can no longer change.` : `For SY ${year.name}. Just the subject: add it to each section, with its teacher, in Teacher Loading. The minutes are counted from the schedule.`,
      fields: [
        { name: "name", label: "Subject name", required: true, value: subject?.name ?? "", help: "Like Mathematics or Filipino.", check: (value, values) => (repeatOf(value, values) ? `${value.trim()} is already in the list.` : value.trim().length > 100 ? "Use at most 100 characters." : null) },
        { name: "code", label: "Code", value: subject?.code ?? "" },
        // The Senior High details are the Admin's (team decision, Nov 21, 2026).
        ...(isAdmin
          ? [
              { name: "term_no", label: `Taken in which ${year.term_label.toLowerCase()}`, type: /** @type {const} */ ("select"), required: true, value: subject ? (subject.term_no ?? "year") : "year", disabled: !!subject?.locked_reason, help: "Whole year for Junior High; Senior High subjects may be for one part only.", options: [{ value: "year", label: "Whole year" }, ...options.terms.map((/** @type {any} */ term) => ({ value: term.term_no, label: term.name }))] },
              { name: "track_id", label: "Track", type: /** @type {const} */ ("select"), value: subject?.track_id ?? "", disabled: !!subject?.locked_reason, help: "For Senior High only, like Academic or TechPro. Leave it on All tracks for Junior High.", options: [{ value: "", label: "All tracks" }, ...options.tracks.map((/** @type {any} */ track) => ({ value: track.id, label: track.name }))] },
              { name: "subject_type", label: "Type", type: /** @type {const} */ ("select"), required: true, value: subject?.subject_type ?? "core", help: "For Senior High only. Junior High subjects are Core.", options: Object.entries(TYPES).map(([value, label]) => ({ value, label })) },
            ]
          : []),
        { name: "is_priority", label: "Priority (placed first, like PE and Homeroom)", type: "checkbox", value: subject?.is_priority ?? false },
        { name: "is_active", label: "Offered this school year", type: "checkbox", value: subject?.is_active ?? true },
      ],
      submitLabel: subject ? "Save changes" : "Add subject",
      onSubmit: async (values) => {
        // No grade and no minutes (beneficiary review, Nov 21, 2026): the grade comes from the
        // section in Teacher Loading, and the minutes from the schedule.
        const body = {
          track_id: isAdmin && values.track_id ? Number(values.track_id) : (subject?.track_id ?? null),
          term_no: isAdmin ? (values.term_no === "year" ? null : Number(values.term_no)) : (subject?.term_no ?? null),
          code: values.code || null,
          name: values.name.trim(),
          subject_type: isAdmin ? values.subject_type : (subject?.subject_type ?? "core"),
          is_priority: values.is_priority,
          is_active: values.is_active,
        };
        await changeRecord(subject ? `/subjects/${subject.id}` : `/school-years/${year.id}/subjects`, subject ? "PUT" : "POST", body);
        return `${body.name} was ${subject ? "saved" : "added"}.`;
      },
      remove: subject ? { label: "Delete this subject", message: `This deletes ${subject.name} from SY ${year.name}.`, blockedReason: subject.locked_reason, run: async () => { await changeRecord(`/subjects/${subject.id}`, "DELETE"); return `${subject.name} was deleted.`; } } : undefined,
    });
  };

  /** Delete straight from the list (a subject with teacher loading stays, and says why). */
  const deleteSubject = async (/** @type {any} */ subject) => {
    if (subject.locked_reason) {
      toast.error(`${subject.name} cannot be deleted: ${subject.locked_reason} Mark it as not offered instead.`);
      return;
    }
    if (!(await confirmAction({ title: `Delete ${subject.name}?`, message: `It is taken out of SY ${year.name}.`, confirmLabel: "Yes, delete" }))) return;
    try {
      await changeRecord(`/subjects/${subject.id}`, "DELETE");
      toast.success(`${subject.name} was deleted.`);
    } catch (error) {
      toast.error(error);
    }
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

  const searchInput = /** @type {HTMLInputElement} */ (h("input", { type: "search", class: "input", placeholder: "Name, code or track", "aria-label": "Search subjects", oninput: () => { ui.search = searchInput.value; draw(); } }));

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "book", title: "Subjects & Class Hours", description: `Step 2 of the setup: the subjects of SY ${year.name}, names only, and the class hours.`, crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Subjects" }], actions: [isAdmin ? h("button", { type: "button", class: "btn btn-outline", onclick: editTracks }, icon("layers"), "Tracks (Senior High)") : null, h("button", { type: "button", class: "btn btn-primary", onclick: () => subjectForm() }, icon("plus"), "Add subject")] }),
      subjectTabs("subjects"),
      content,
    ),
  );

  const draw = async () => {
    try {
      const subjects = await getRecords(`/school-years/${year.id}/subjects`);
      options = await getRecords(`/school-years/${year.id}/subject-options`);
      const words = ui.search.trim().toLowerCase();
      const shown = subjects.filter((/** @type {any} */ subject) => (ui.term === "" || String(subject.term_no ?? "year") === ui.term) && (!words || `${subject.name} ${subject.code ?? ""} ${subject.track ?? ""}`.toLowerCase().includes(words)));

      replace(
        content,
        h(
          "div",
          { class: `card grid gap-3 p-3 ${isAdmin ? "sm:grid-cols-2" : ""}` },
          h("div", { class: "space-y-1" }, h("label", { class: "field-label" }, "Search"), searchInput),
          !isAdmin ? null : searchableSelect({ label: "When", value: ui.term, options: [{ value: "", label: "Any time" }, { value: "year", label: "Whole year" }, ...options.terms.map((/** @type {any} */ term) => ({ value: String(term.term_no), label: term.name }))], onChange: (value) => { ui.term = String(value); draw(); } }),
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
                  { label: "Subject", primary: true, cell: (/** @type {any} */ subject) => h("span", null, subject.name, subject.is_priority ? h("span", { class: "badge ml-2 bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100" }, "Priority") : null, subject.is_active ? null : h("span", { class: "badge ml-2 bg-surface-muted" }, "Not offered"), subject.grade ? h("span", { class: "badge ml-2 bg-surface-muted", title: "Made for one grade before Nov 21, 2026" }, `Grade ${subject.grade} only`) : null) },
                  ...(isAdmin
                    ? [
                        { label: "When", cell: (/** @type {any} */ subject) => termName(subject.term_no) },
                        { label: "Track (SHS)", cell: (/** @type {any} */ subject) => subject.track ?? "All tracks" },
                        { label: "Type", cell: (/** @type {any} */ subject) => TYPES[/** @type {keyof typeof TYPES} */ (subject.subject_type)] },
                      ]
                    : []),
                ],
                actions: (/** @type {any} */ subject) => [editButton(subject.name, () => subjectForm(subject)), h("button", { type: "button", class: "btn btn-quiet text-danger", "aria-label": `Delete ${subject.name}`, onclick: () => deleteSubject(subject) }, icon("trash"), "Delete")],
              }),
      );
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };

  const stop = watch(["records"], draw);
  await draw();
  return stop;
}
