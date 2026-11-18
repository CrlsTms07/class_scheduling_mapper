// @ts-check
/**
 * Step 5 of the setup: Teachers (teaching and non-teaching personnel), with qualifications and
 * teaching-related tasks per term, and a page for each teacher with their classes. A personnel
 * record may exist without an account. Only teaching personnel get subjects or an advisory.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { dataList, editButton } from "@/components/data-list.js";
import { openFormDialog } from "@/components/form-dialog.js";
import { openListEditor } from "@/components/list-editor.js";
import { skeletonList, skeletonPage } from "@/components/loading.js";
import { breadcrumbs, emptyState, pageHeader } from "@/components/page-header.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { api, errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { load, watch } from "@/state/cache.js";
import { termState } from "@/state/term.js";
import { DAY_NAMES } from "@/lib/schedule.js";
import { timeRange } from "@/lib/time.js";

const SHIFTS = { WHOLE_DAY: "Whole day", AM: "Morning (AM)", PM: "Afternoon (PM)" };
const DEGREE_LEVELS = ["Bachelor", "Master", "Doctorate", "Units"];
const LEVEL_TABS = [["", "All"], ["JHS", "Junior High"], ["SHS", "Senior High"], ["none", "No classes yet"]];

/**
 * The education rows of a teacher, edited inside the form: add, change or remove a degree.
 * @param {any[]} start
 */
function qualificationsEditor(start) {
  /** @type {any[]} */
  let rows = start.map((row) => ({ ...row }));
  const list = h("div", { class: "space-y-3" });
  const input = (/** @type {any} */ row, /** @type {string} */ key, /** @type {string} */ label, /** @type {string} */ type = "text") => {
    const id = `qual-${Math.random().toString(36).slice(2, 8)}`;
    const element = /** @type {HTMLInputElement} */ (h("input", { id, type, class: "input", inputMode: type === "number" ? "numeric" : undefined, oninput: () => { row[key] = type === "number" ? (element.value ? Number(element.value) : null) : element.value; } }));
    element.value = row[key] ?? "";
    return h("div", { class: "space-y-1" }, h("label", { class: "field-label", htmlFor: id }, label), element);
  };
  const draw = () => {
    replace(
      list,
      rows.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "No degrees yet.") : null,
      rows.map((row, index) =>
        h("div", { class: "space-y-2 rounded-lg border p-3" },
          h("div", { class: "grid gap-2 sm:grid-cols-2" },
            searchableSelect({ label: "Level", value: row.degree_level, options: DEGREE_LEVELS.map((level) => ({ value: level, label: level })), onChange: (value) => { row.degree_level = value; } }),
            input(row, "degree", "Degree"), input(row, "major", "Major"), input(row, "school", "School"), input(row, "year_completed", "Year completed", "number"),
          ),
          h("button", { type: "button", class: "btn btn-outline text-danger", onclick: () => { rows = rows.filter((_, other) => other !== index); draw(); } }, icon("trash"), "Remove this degree"),
        ),
      ),
      h("button", { type: "button", class: "btn btn-outline", onclick: () => { rows.push({ degree_level: "Bachelor", degree: "", major: null, school: null, year_completed: null }); draw(); } }, icon("plus"), "Add a degree"),
    );
  };
  draw();
  return { element: h("fieldset", { class: "space-y-2" }, h("legend", { class: "font-semibold text-accent" }, "Education"), list), read: () => rows.filter((row) => row.degree.trim()).map((row) => ({ ...row, major: row.major || null, school: row.school || null })) };
}

/** @type {import("@/router.js").RenderPage} */
export async function render(container, { query }) {
  const term = termState.term;
  if (!term) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "Start a school year first, on the School Years page." })));
    return;
  }
  const ui = { search: "", level: "", type: "", status: "active" };
  const content = h("div", { class: "space-y-5" }, skeletonList(5));
  /** @type {any} */
  let options = { departments: [], designations: [], tasks: [] };

  const addOption = (/** @type {string} */ type) => async (/** @type {string} */ typed) => {
    const { data } = /** @type {{ data: { id: number, name: string } }} */ (await api(`/personnel-options/${type}`, { method: "POST", body: { name: typed } }));
    return { value: data.id, label: data.name };
  };

  const teacherForm = async (/** @type {any} */ teacher = null) => {
    // The choices are loaded first, so a quick tap never opens an empty form.
    options = await getRecords("/personnel-options");
    const education = qualificationsEditor(teacher?.qualifications ?? []);
    openFormDialog({
      title: teacher ? `Edit ${teacher.printed_name}` : "Add a teacher",
      description: `Personnel record. Tasks are for ${term.name}.`,
      fields: [
        { name: "first_name", label: "First name", required: true, value: teacher?.first_name },
        { name: "middle_name", label: "Middle name", value: teacher?.middle_name ?? "" },
        { name: "last_name", label: "Last name", required: true, value: teacher?.last_name },
        { name: "suffix", label: "Suffix", value: teacher?.suffix ?? "" },
        { name: "display_name", label: "Name on printed forms", value: teacher?.display_name ?? "", help: "Leave empty to use the first name, middle initial and last name." },
        { name: "personnel_type", label: "Personnel", type: "select", required: true, value: teacher?.personnel_type ?? "teaching", options: [{ value: "teaching", label: "Teaching" }, { value: "non_teaching", label: "Non-teaching" }], help: "Only teaching personnel get subjects or an advisory." },
        { name: "department_id", label: "Department", type: "select", value: teacher?.department_id ?? "", options: [{ value: "", label: "None" }, ...options.departments.map((/** @type {any} */ item) => ({ value: item.id, label: item.name }))], onCreate: addOption("departments") },
        { name: "designation_id", label: "Designation", type: "select", value: teacher?.designation_id ?? "", options: [{ value: "", label: "None" }, ...options.designations.map((/** @type {any} */ item) => ({ value: item.id, label: item.name }))], onCreate: addOption("designations") },
        { name: "shift", label: "Shift", type: "select", required: true, value: teacher?.shift ?? "WHOLE_DAY", options: Object.entries(SHIFTS).map(([value, label]) => ({ value, label })) },
        { name: "max_hours_per_week", label: "Most hours a week", type: "number", required: true, min: 1, max: 60, value: teacher?.max_hours_per_week ?? 30, help: "The limit used by Load Distribution. Default 30." },
        { name: "task_ids", label: `Tasks this ${term.school_year.term_label.toLowerCase()}`, type: "multi", wide: true, value: teacher?.task_ids ?? [], options: options.tasks.map((/** @type {any} */ item) => ({ value: item.id, label: item.name })), help: "Like ICT Coordinator, SSG Adviser or Lab Manager. Add or remove tasks with Edit lists on the Teachers page." },
        { name: "is_active", label: "Active (can be given subjects)", type: "checkbox", value: teacher?.is_active ?? true },
      ],
      extra: education.element,
      submitLabel: teacher ? "Save changes" : "Add teacher",
      onSubmit: async (values) => {
        const id = (/** @type {any} */ value) => (value === "" || value === null ? null : Number(value));
        const body = { ...values, middle_name: values.middle_name || null, suffix: values.suffix || null, display_name: values.display_name || null, department_id: id(values.department_id), designation_id: id(values.designation_id), task_ids: values.task_ids.map(Number), qualifications: education.read() };
        await changeRecord(teacher ? `/terms/${term.id}/teachers/${teacher.id}` : `/terms/${term.id}/teachers`, teacher ? "PUT" : "POST", body);
        return `${values.first_name} ${values.last_name} was ${teacher ? "saved" : "added"}.`;
      },
      remove: teacher ? { label: "Delete this teacher", message: `This deletes the record of ${teacher.printed_name}.`, blockedReason: teacher.cannot_delete_reason, run: async () => { await changeRecord(`/terms/${term.id}/teachers/${teacher.id}`, "DELETE"); return `${teacher.printed_name} was deleted.`; } } : undefined,
    });
  };

  // The lists the teacher form chooses from. A name still used by a record stays (the server says so).
  const editLists = () =>
    openListEditor({
      title: "Departments, designations and tasks",
      description: "The choices in the teacher form. A name can be deleted only when no personnel record uses it.",
      load: async () => {
        const loaded = await getRecords("/personnel-options");
        const group = (/** @type {string} */ label, /** @type {string} */ noun, /** @type {string} */ type, /** @type {any[]} */ items) => ({
          label,
          noun,
          items,
          add: (/** @type {string} */ name) => changeRecord(`/personnel-options/${type}`, "POST", { name }),
          remove: (/** @type {{ id: number }} */ item) => changeRecord(`/personnel-options/${type}/${item.id}`, "DELETE"),
        });
        return [
          group("Departments", "department", "departments", loaded.departments),
          group("Designations", "designation", "designations", loaded.designations),
          group("Tasks", "task", "teaching-tasks", loaded.tasks),
        ];
      },
    });

  const searchInput = /** @type {HTMLInputElement} */ (h("input", { type: "search", class: "input", placeholder: "Name, department or designation", "aria-label": "Search teachers", oninput: () => { ui.search = searchInput.value; draw(); } }));

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "users", title: "Teachers", description: `Step 5 of the setup: teaching and non-teaching personnel, ${term.name}, SY ${term.school_year.name}.`, crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Teachers" }], actions: [h("button", { type: "button", class: "btn btn-outline", onclick: editLists }, icon("pencil"), "Edit lists"), h("button", { type: "button", class: "btn btn-primary", onclick: () => teacherForm() }, icon("plus"), "Add teacher")] }),
      content,
    ),
  );

  const draw = async () => {
    try {
      const [teachers, loaded] = await Promise.all([getRecords(`/terms/${term.id}/teachers`), getRecords("/personnel-options")]);
      options = loaded;
      const matchesLevel = (/** @type {any} */ teacher, /** @type {string} */ level) => level === "" || (level === "none" ? (teacher.levels ?? []).length === 0 : (teacher.levels ?? []).includes(level));
      const words = ui.search.trim().toLowerCase();
      const shown = teachers.filter((/** @type {any} */ teacher) => matchesLevel(teacher, ui.level) && (!ui.type || teacher.personnel_type === ui.type) && (!ui.status || (ui.status === "active") === teacher.is_active) && (!words || `${teacher.first_name} ${teacher.last_name} ${teacher.printed_name} ${teacher.department ?? ""} ${teacher.designation ?? ""}`.toLowerCase().includes(words)));
      replace(
        content,
        h("div", { role: "tablist", "aria-label": "Department", class: "grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1 sm:flex sm:w-fit" }, LEVEL_TABS.map(([key, label]) => h("button", { type: "button", role: "tab", "aria-selected": String(ui.level === key), class: `btn ${ui.level === key ? "bg-surface shadow-sm" : "text-muted-foreground"}`, onclick: () => { ui.level = key; draw(); } }, `${label} (${teachers.filter((/** @type {any} */ teacher) => matchesLevel(teacher, key)).length})`))),
        h("div", { class: "card grid gap-3 p-3 sm:grid-cols-3" },
          h("div", { class: "space-y-1" }, h("label", { class: "field-label" }, "Search"), searchInput),
          searchableSelect({ label: "Personnel", value: ui.type, options: [{ value: "", label: "Teaching and non-teaching" }, { value: "teaching", label: "Teaching" }, { value: "non_teaching", label: "Non-teaching" }], onChange: (value) => { ui.type = String(value); draw(); } }),
          searchableSelect({ label: "Status", value: ui.status, options: [{ value: "", label: "Active and inactive" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }], onChange: (value) => { ui.status = String(value); draw(); } }),
        ),
        teachers.length === 0
          ? emptyState({ title: "No teachers yet", text: "Add the school's teachers. A teacher can also be added from Teacher Loading by typing a new name.", action: h("button", { type: "button", class: "btn btn-primary", onclick: () => teacherForm() }, icon("plus"), "Add teacher") })
          : shown.length === 0
            ? h("p", { class: "text-sm text-muted-foreground" }, "No teacher matches what is chosen above.")
            : dataList({
                label: "Teachers",
                items: shown,
                columns: [
                  { label: "Name", primary: true, cell: (/** @type {any} */ teacher) => h("a", { href: `/teachers/${teacher.id}`, class: "inline-flex min-h-11 items-center text-brand underline-offset-2 hover:underline" }, teacher.printed_name) },
                  { label: "Department", cell: (/** @type {any} */ teacher) => teacher.department ?? "–" },
                  { label: "Shift", cell: (/** @type {any} */ teacher) => SHIFTS[/** @type {keyof typeof SHIFTS} */ (teacher.shift)] },
                  { label: "Subjects", cell: (/** @type {any} */ teacher) => (teacher.personnel_type === "teaching" ? `${teacher.assigned} of ${teacher.max_subjects}` : "Non-teaching") },
                  { label: "Advisory", cell: (/** @type {any} */ teacher) => teacher.advisory ?? "–" },
                  { label: "Account", cell: (/** @type {any} */ teacher) => teacher.account_email ?? "None" },
                ],
                actions: (/** @type {any} */ teacher) => [teacher.can_edit === false ? h("span", { class: "text-small text-muted-foreground" }, "Kept by the Admin") : editButton(teacher.printed_name, () => teacherForm(teacher)), h("a", { href: `/teachers/${teacher.id}`, class: "btn btn-quiet" }, "Classes")],
              }),
      );
      if (query.get("edit") && !content.dataset.opened) {
        content.dataset.opened = "1";
        const wanted = teachers.find((/** @type {any} */ teacher) => teacher.id === Number(query.get("edit")));
        if (wanted) teacherForm(wanted);
      }
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };

  const stop = watch(["records"], draw);
  await draw();
  return stop;
}

/** One teacher: their record and their classes this term. */
/** @type {import("@/router.js").RenderPage} */
export async function renderDetail(container, { params }) {
  const term = termState.term;
  if (!term) return;
  const teacherId = Number(params.teacherId);
  replace(container, skeletonPage());
  try {
    const [teachers, schedule] = await Promise.all([getRecords(`/terms/${term.id}/teachers`), load(["terms", term.id, "teachers", teacherId, "schedule"], async () => /** @type {{ data: any }} */ (await api(`/terms/${term.id}/teachers/${teacherId}/schedule`)).data)]);
    const teacher = teachers.find((/** @type {any} */ item) => item.id === teacherId);
    if (!teacher) {
      replace(container, h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "Teacher not found", text: "This teacher is not in the list for the term selected at the top.", action: h("a", { href: "/teachers", class: "btn btn-outline" }, "All teachers") })));
      return;
    }
    replace(
      container,
      h(
        "div",
        { class: "space-y-5 p-4 sm:p-6" },
        breadcrumbs([{ label: "Home", to: "/dashboard" }, { label: "Teachers", to: "/teachers" }, { label: teacher.printed_name }]),
        pageHeader({ icon: "user", title: teacher.printed_name, description: [teacher.designation, teacher.department, SHIFTS[/** @type {keyof typeof SHIFTS} */ (teacher.shift)]].filter(Boolean).join(" · "), actions: teacher.can_edit === false ? null : h("a", { href: `/teachers?edit=${teacher.id}`, class: "btn btn-outline" }, icon("pencil"), "Edit") }),
        h("div", { class: "grid grid-cols-2 gap-3 lg:grid-cols-4" },
          [["Subjects", `${teacher.assigned} of ${teacher.max_subjects}`], ["Minutes a week", String(schedule.minutes_per_week)], ["Advisory", teacher.advisory ?? "None"], ["Account", teacher.account_email ? "Linked" : "None"]].map(([label, value]) => h("div", { class: "card p-4" }, h("p", { class: "text-small text-muted-foreground" }, label), h("p", { class: "text-lg font-bold text-accent" }, value))),
        ),
        h("section", { class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, `Classes in ${term.name}`), schedule.classes.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "No classes this term yet.") : h("ul", { class: "grid gap-3 lg:grid-cols-2" }, schedule.classes.map((/** @type {any} */ item) =>
          h("li", { class: "card space-y-2 p-4" },
            h("div", { class: "flex items-start justify-between gap-2" }, item.section_id ? h("a", { href: `/schedule/sections/${item.section_id}`, class: "font-semibold text-brand underline-offset-2 hover:underline" }, item.section) : h("span", { class: "font-semibold" }, item.section), h("span", { class: "text-small text-muted-foreground" }, `${item.minutes_per_week} mins a week`)),
            h("p", { class: "text-sm" }, item.subject ?? "Activity"),
            h("ul", { class: "space-y-0.5 text-small text-muted-foreground" }, item.meetings.map((/** @type {any} */ meeting) => h("li", null, `${DAY_NAMES[meeting.day]}, ${timeRange(meeting.start_time, meeting.end_time)}${meeting.room ? ` · ${meeting.room}` : ""}${meeting.status !== "approved" ? ` · ${meeting.status}` : ""}`))),
          ),
        ))),
        teacher.qualifications.length ? h("section", { class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, "Education"), h("ul", { class: "card divide-y" }, teacher.qualifications.map((/** @type {any} */ item) => h("li", { class: "p-3 text-sm" }, h("p", { class: "font-medium" }, `${item.degree_level}: ${item.degree}`), h("p", { class: "text-small text-muted-foreground" }, [item.major, item.school, item.year_completed].filter(Boolean).join(" · ")))))) : null,
      ),
    );
  } catch (error) {
    replace(container, h("p", { role: "alert", class: "p-6 text-danger" }, errorMessage(error)));
  }
}
