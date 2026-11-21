// @ts-check
/**
 * Teacher Loading: who teaches each subject of a section in this term (by section), and how
 * much each teacher carries (Load Distribution). Every choice saves at once and says so.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { openDialog, setBusy } from "@/components/dialog.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { getSections, quickAddTeacher } from "@/api/schedule.js";
import { assignTeacher, copyLoading, getSectionLoading, getTeacherLoad, importPrevious, removeTeacher, shiftWarning, teacherHint } from "@/api/teacher-loading.js";
import { watch } from "@/state/cache.js";
import { termState, termWord } from "@/state/term.js";

/** @typedef {import("@/api/teacher-loading.js").SectionLoading} SectionLoading */

/** @type {import("@/router.js").RenderPage} */
export async function render(container, { query, navigate }) {
  const term = termState.term;
  if (!term) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "The Admin starts a school year on the School Years page." })));
    return;
  }

  const view = query.get("view") === "teachers" ? "teachers" : "sections";
  const content = h("div", { class: "space-y-4" }, skeletonList(5));

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({
        icon: "clipboard",
        title: "Teacher Loading",
        description: `Step 5 of the setup: who teaches what in ${term.name}, SY ${term.school_year.name}.`,
        crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Teacher Loading" }],
        actions: h("button", { type: "button", class: "btn btn-outline", onclick: () => openCopyTeachersDialog(currentSection) }, icon("copy"), "Copy teachers"),
      }),
      h(
        "details",
        { class: "card" },
        h("summary", { class: "flex min-h-11 cursor-pointer items-center px-3 text-sm font-medium" }, "How this works"),
        h(
          "ul",
          { class: "list-disc space-y-1 px-3 pb-3 pl-8 text-sm text-muted-foreground" },
          [
            "Pick a section, then choose a teacher for each subject. Each choice saves right away.",
            `Teacher loading is set separately for each ${termWord(term)}. The subjects listed are those of the section's grade, ${termWord(term)} and track.`,
            "The numbers beside a name show how many subjects that teacher already has, out of their limit.",
            'Type a name that is not on the list to "Add new teacher". Complete their details later on the Teachers page.',
            "After loading, open the section's schedule to place the subjects.",
          ].map((line) => h("li", null, line)),
        ),
      ),
      h(
        "div",
        { role: "tablist", "aria-label": "Show", class: "grid grid-cols-2 gap-1 rounded-xl border bg-surface-muted p-1 sm:max-w-md" },
        [["sections", "By section", ""], ["teachers", "By teacher", " (Load Distribution)"]].map(([key, label, more]) =>
          h("a", { href: key === "teachers" ? "/teacher-loading?view=teachers" : "/teacher-loading", role: "tab", "aria-selected": String(view === key), class: `btn whitespace-normal px-2 text-center leading-tight ${view === key ? "bg-brand text-white" : "text-muted-foreground"}` }, label, more ? h("span", { class: "hidden sm:inline" }, more) : null),
        ),
      ),
      content,
    ),
  );

  /** @type {null | { id: number, label: string }} */
  let currentSection = null;

  /* ---------- Copy teachers: one place for both ways (design audit, B3) ---------- */

  /** @param {null | { id: number, label: string }} section */
  function openCopyTeachersDialog(section) {
    const sameYear = termState.terms.filter((other) => other.school_year.id === term.school_year.id && other.id !== term.id);
    const earlier = termState.terms.filter((other) => other.start_date < term.start_date);
    if (sameYear.length === 0 && earlier.length === 0) {
      toast.info("There is no other term to copy from yet.");
      return;
    }

    /** @type {{ way: "same" | "earlier", fromId: number, wholeScope: boolean }} */
    const choice = { way: sameYear.length ? "same" : "earlier", fromId: (sameYear[0] ?? earlier[0]).id, wholeScope: !section };
    const area = h("div", { class: "space-y-4" });
    const result = h("div", { "aria-live": "polite" });
    const action = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", onclick: () => run() }, "Copy the teachers"));
    /** @type {any} */
    let reviewed = null;

    const draw = () => {
      const terms = choice.way === "same" ? sameYear : earlier;
      if (!terms.some(({ id }) => id === choice.fromId)) choice.fromId = terms[0]?.id;
      const toggle = (/** @type {boolean} */ isOn) => `btn w-full justify-start border text-left whitespace-normal ${isOn ? "border-brand bg-brand text-white" : "bg-surface"}`;
      replace(
        area,
        h(
          "div",
          { role: "group", "aria-label": "Copy from", class: "grid gap-2" },
          sameYear.length ? h("button", { type: "button", "aria-pressed": String(choice.way === "same"), class: toggle(choice.way === "same"), onclick: () => { choice.way = "same"; reviewed = null; result.replaceChildren(); draw(); } }, h("span", null, h("span", { class: "block font-medium" }, `Another ${termWord(term)} of this school year`), h("span", { class: "block text-small opacity-90" }, "Same subjects: the teachers of subjects taught in both are copied."))) : null,
          earlier.length ? h("button", { type: "button", "aria-pressed": String(choice.way === "earlier"), class: toggle(choice.way === "earlier"), onclick: () => { choice.way = "earlier"; reviewed = null; result.replaceChildren(); draw(); } }, h("span", null, h("span", { class: "block font-medium" }, "An earlier term, also of last school year"), h("span", { class: "block text-small opacity-90" }, "Matched by section and subject names, for all your grade levels. You see what will be copied first."))) : null,
        ),
        searchableSelect({ label: "Term", value: choice.fromId, options: terms.map((other) => ({ value: other.id, label: `${other.name}, SY ${other.school_year.name}` })), onChange: (value) => { choice.fromId = Number(value); reviewed = null; result.replaceChildren(); } }),
        choice.way === "same" && section
          ? h(
              "div",
              { role: "group", "aria-label": "Which sections", class: "grid gap-2" },
              [[false, `Only ${section.label}`], [true, "All sections of my grade levels"]].map(([value, label]) => h("button", { type: "button", "aria-pressed": String(choice.wholeScope === value), class: toggle(choice.wholeScope === value), onclick: () => { choice.wholeScope = /** @type {boolean} */ (value); draw(); } }, label)),
            )
          : null,
        result,
      );
      action.textContent = choice.way === "earlier" && !reviewed ? "Review" : "Copy the teachers";
    };

    const plural = (/** @type {number} */ count, /** @type {string} */ one) => `${count} ${count === 1 ? one : `${one}s`}`;

    const run = async () => {
      setBusy(action, true, "Copying...");
      try {
        if (choice.way === "same") {
          const done = await copyLoading(term.id, { from_term_id: choice.fromId, section_id: choice.wholeScope || !section ? null : section.id });
          toast.success([`${plural(done.copied, "subject")} copied.`, done.already_set ? `${done.already_set} already had a teacher and stay as they are.` : "", done.not_offered ? `${done.not_offered} are not taken this ${termWord(term)}.` : "", done.teacher_unavailable ? `${done.teacher_unavailable} had a teacher who is no longer active.` : "", done.full_load ? `${done.full_load} were left without a teacher because the teacher already has a full load.` : ""].filter(Boolean).join(" "));
          close();
          return;
        }
        if (!reviewed) {
          reviewed = await importPrevious(term.id, { from_term_id: choice.fromId, preview: true });
          setBusy(action, false);
          replace(
            result,
            h("div", { class: "space-y-1 rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" },
              h("p", { class: "font-medium" }, `${plural(reviewed.copied, "subject")} with a teacher will be copied, in ${plural(reviewed.sections, "section")}.`),
              reviewed.already_set ? h("p", null, `${plural(reviewed.already_set, "subject")} already have a teacher here and stay as they are.`) : null,
              reviewed.teacher_unavailable ? h("p", null, `${plural(reviewed.teacher_unavailable, "subject")} had a teacher who is no longer active.`) : null,
              reviewed.full_load ? h("p", null, `${plural(reviewed.full_load, "subject")} will have no teacher, because the teacher already has a full load.`) : null,
              reviewed.missing.map((/** @type {string} */ line) => h("p", null, line)),
            ),
          );
          action.textContent = "Copy the teachers";
          action.disabled = reviewed.copied === 0;
          return;
        }
        const done = await importPrevious(term.id, { from_term_id: choice.fromId, preview: false });
        toast.success(`Imported: ${plural(done.copied, "subject")} with a teacher, in ${plural(done.sections, "section")}.`);
        close();
      } catch (error) {
        toast.error(error);
        setBusy(action, false);
      }
    };

    const { close } = openDialog({
      title: "Copy teachers",
      description: `Fills ${term.name} with teachers from another term. Subjects that already have a teacher stay as they are. Schedules are not copied here: use New schedule on the Schedule page.`,
      body: area,
      footer: [h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"), action],
    });
    draw();
  }

  /* ---------- By section ---------- */

  /**
   * One subject: its teacher, chosen with a searchable list that can add a new teacher.
   * @param {SectionLoading} loading
   * @param {import("@/api/teacher-loading.js").LoadingRow} row
   */
  const rowCard = (loading, row) => {
    const sectionId = loading.section.id;
    const current = loading.teachers.find(({ id }) => id === row.teacher_id);
    const warning = current ? shiftWarning(current.shift, loading.section.shift) : null;
    const options = [
      { value: "", label: "No teacher yet" },
      ...(row.teacher_id && !current ? [{ value: row.teacher_id, label: row.teacher ?? "" }] : []),
      ...loading.teachers.map((teacher) => {
        const isFull = teacher.assigned >= teacher.limit && teacher.id !== row.teacher_id;
        return { value: teacher.id, label: teacher.name, hint: teacherHint(teacher, isFull), disabled: isFull };
      }),
    ];

    const save = async (/** @type {number | null} */ teacherId, /** @type {string} */ name) => {
      try {
        if (teacherId) await assignTeacher(term.id, sectionId, row.subject_id, teacherId);
        else await removeTeacher(term.id, sectionId, row.subject_id);
        toast.success(teacherId ? `${name} now teaches ${row.subject}.` : `${row.subject} has no teacher now.`);
      } catch (error) {
        toast.error(error);
        drawSection();
      }
    };

    return h(
      "li",
      { class: `space-y-2 p-4 ${row.teacher_id ? "" : "bg-amber-50/50 dark:bg-amber-950/30"}` },
      h(
        "div",
        { class: "grid gap-3 md:grid-cols-2 md:items-center" },
        h(
          "div",
          { class: "min-w-0" },
          h("p", { class: "flex items-center gap-2 font-medium" }, h("span", { class: `size-2.5 shrink-0 rounded-full ${row.teacher_id ? "bg-emerald-500" : "bg-amber-400"}`, "aria-hidden": "true" }), row.subject),
          h(
            "div",
            { class: "flex flex-wrap items-center gap-1 pl-4.5 text-small text-muted-foreground" },
            `${row.scheduled_minutes} mins a week on the schedule`,
            row.is_priority ? h("span", { class: "badge bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100" }, "Priority") : null,
            !row.is_active ? h("span", { class: "badge bg-surface-muted" }, "Not offered") : null,
            row.placed_entries > 0 ? h("span", { class: "badge bg-surface-muted" }, "On the schedule") : null,
          ),
        ),
        searchableSelect({
          label: `Teacher of ${row.subject}`,
          value: row.teacher_id ?? "",
          disabled: !!row.locked_reason,
          options,
          onChange: (value, option) => save(value ? Number(value) : null, option?.label ?? ""),
          create: {
            label: (typed) => `Add new teacher "${typed}"`,
            run: async (typed) => {
              const parts = typed.trim().split(/\s+/);
              if (parts.length < 2) {
                toast.error("Type the first and last name of the new teacher.");
                return;
              }
              try {
                const teacher = await quickAddTeacher({ first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] });
                await save(teacher.id, teacher.name);
                toast.info("Complete the new teacher's details, like the department, later on the Teachers page.");
              } catch (error) {
                toast.error(error);
              }
            },
          },
        }),
      ),
      row.locked_reason ? h("p", { class: "flex items-start gap-2 text-small text-warning" }, icon("lock", "size-4 shrink-0"), row.locked_reason) : null,
      current && current.assigned > current.limit ? h("p", { class: "text-small text-warning" }, `${current.name} has more than a full load: ${current.assigned} of ${current.limit} subjects. Give one of them to another teacher.`) : null,
      warning ? h("p", { class: "text-small text-warning" }, warning) : null,
    );
  };

  /**
   * "Add a subject": one form with the subject and its teacher, for this section (beneficiary
   * review, Nov 21, 2026: subject, section and teacher are joined in one form; the subject has no
   * grade of its own, it takes the section's).
   * @param {import("@/api/teacher-loading.js").SectionLoading} loading
   */
  const addSubjectForm = (loading) => {
    if (loading.addable.length === 0) return null;
    /** @type {{ subjectId: number | null, teacherId: number | null }} */
    const choice = { subjectId: null, teacherId: null };
    const addButton = /** @type {HTMLButtonElement} */ (h("button", {
      type: "button",
      class: "btn btn-primary",
      disabled: true,
      onclick: async () => {
        if (!choice.subjectId || !choice.teacherId) return;
        const subject = loading.addable.find(({ id }) => id === choice.subjectId);
        const teacher = loading.teachers.find(({ id }) => id === choice.teacherId);
        setBusy(addButton, true, "Adding...");
        try {
          await assignTeacher(term.id, loading.section.id, choice.subjectId, choice.teacherId);
          toast.success(`${subject?.name} was added to ${loading.section.label}, taught by ${teacher?.name}.`);
          drawSection();
        } catch (error) {
          toast.error(error);
          setBusy(addButton, false);
        }
      },
    }, icon("plus"), "Add"));
    const ready = () => { addButton.disabled = !(choice.subjectId && choice.teacherId); };
    return h(
      "section",
      { "aria-label": "Add a subject", class: "card space-y-3 p-4" },
      h("div", null, h("h2", { class: "font-semibold text-accent" }, "Add a subject"), h("p", { class: "text-small text-muted-foreground" }, `A subject ${loading.section.label} takes, with its teacher. The minutes are counted from the schedule.`)),
      h(
        "div",
        { class: "grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end" },
        searchableSelect({ label: "Subject", placeholder: "Choose a subject", options: loading.addable.map((item) => ({ value: item.id, label: item.name, hint: item.code ?? undefined })), onChange: (value) => { choice.subjectId = Number(value); ready(); } }),
        searchableSelect({
          label: "Teacher",
          placeholder: "Choose a teacher",
          options: loading.teachers.map((teacher) => {
            const isFull = teacher.assigned >= teacher.limit;
            return { value: teacher.id, label: teacher.name, hint: teacherHint(teacher, isFull), disabled: isFull };
          }),
          onChange: (value) => { choice.teacherId = Number(value); ready(); },
        }),
        addButton,
      ),
    );
  };

  const drawSection = async () => {
    const sections = await getSections(term.id);
    if (sections.length === 0) {
      replace(content, emptyState({ title: "No sections yet", text: "There are no sections in your grade levels for this school year yet.", action: h("a", { href: "/sections", class: "btn btn-primary" }, icon("plus"), "Add a section") }));
      return;
    }
    const wanted = Number(new URLSearchParams(location.search).get("section"));
    const section = sections.find(({ id }) => id === wanted) ?? sections[0];
    currentSection = { id: section.id, label: `Grade ${section.grade} – ${section.name}` };

    const loading = await getSectionLoading(term.id, section.id);
    const done = loading.rows.filter(({ teacher_id: teacherId }) => teacherId !== null).length;
    const total = loading.rows.length;
    const addForm = addSubjectForm(loading);

    replace(
      content,
      h(
        "div",
        { class: "card flex flex-col gap-3 p-3 sm:flex-row sm:items-end sm:justify-between" },
        h("div", { class: "sm:w-96" }, searchableSelect({ label: "Section", value: section.id, options: sections.map((item) => ({ value: item.id, label: `Grade ${item.grade} – ${item.name}`, hint: item.adviser ? `Adviser: ${item.adviser}` : undefined })), onChange: (value) => navigate(`/teacher-loading?section=${value}`) })),
        h("a", { href: `/schedule/sections/${section.id}`, class: "btn btn-outline" }, "Open the schedule", icon("arrow-right")),
      ),
      addForm,
      total === 0
        ? emptyState({ title: "No subjects for this section yet", text: loading.addable.length ? "Add each subject this section takes, with its teacher, using Add a subject above." : "There is no subject to add. Add the subjects of the school year on the Subjects page first.", action: loading.addable.length ? null : h("a", { href: "/subjects", class: "btn btn-outline" }, "Open Subjects") })
        : [
            h(
              "div",
              { class: "space-y-1.5", "aria-live": "polite" },
              h("div", { class: "flex items-center justify-between gap-2 text-sm" }, h("p", { class: "text-muted-foreground" }, `${done} of ${total} subjects have a teacher.`), done === total ? h("span", { class: "badge bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" }, "Ready to plot") : null),
              h("div", { class: "h-2 rounded-full bg-surface-muted", "aria-hidden": "true" }, h("div", { class: `h-full rounded-full ${done === total ? "bg-success" : "bg-brand"}`, style: { width: `${(done / total) * 100}%` } })),
            ),
            h("ol", { class: "card divide-y overflow-visible" }, loading.rows.map((row) => rowCard(loading, row))),
          ],
    );
  };

  /* ---------- By teacher: Load Distribution ---------- */

  const drawTeachers = async () => {
    const data = await getTeacherLoad(term.id);
    const teachers = [...data.teachers].sort((a, b) => b.hours_per_week - a.hours_per_week || a.name.localeCompare(b.name));
    if (teachers.length === 0) {
      replace(content, emptyState({ title: "No loading yet", text: "No teacher has loading in your grade levels yet. Choose teachers by section first.", action: h("a", { href: "/teacher-loading", class: "btn btn-outline" }, "By section") }));
      return;
    }

    const isFull = (/** @type {any} */ teacher) => teacher.assigned >= teacher.limit;
    const bar = (/** @type {any} */ teacher) =>
      h(
        "div",
        { class: "space-y-1" },
        h("div", { class: "h-2 w-full rounded-full bg-surface-muted", role: "meter", "aria-label": `${teacher.name}: ${teacher.assigned} of ${teacher.limit} subjects`, "aria-valuenow": String(teacher.assigned), "aria-valuemin": "0", "aria-valuemax": String(teacher.limit) }, h("div", { class: `h-2 rounded-full ${teacher.is_overloaded ? "bg-danger" : isFull(teacher) ? "bg-amber-500" : "bg-teal-600"}`, style: { width: `${Math.min(100, (teacher.assigned / teacher.limit) * 100)}%` } })),
        h("p", { class: `text-small ${teacher.is_overloaded ? "font-bold text-danger" : "text-muted-foreground"}` }, `${teacher.assigned} of ${teacher.limit} subjects · ${teacher.hours_per_week} hours a week`),
      );
    const status = (/** @type {any} */ teacher) =>
      h("div", { class: "flex flex-wrap gap-1" },
        teacher.is_overloaded ? h("span", { class: "badge bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100" }, "Over the limit") : null,
        !teacher.is_overloaded && isFull(teacher) ? h("span", { class: "badge bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100" }, "Full load") : null,
        !isFull(teacher) ? h("span", { class: "badge bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" }, "OK") : null,
      );
    const fix = (/** @type {any} */ teacher) =>
      teacher.is_overloaded
        ? h("div", { class: "mt-2 space-y-1 rounded-lg border border-danger/30 p-2 text-small" }, h("p", { class: "font-medium text-danger" }, "How to fix"), h("p", null, "Give one of these subjects to another teacher: open its section below and choose another teacher."))
        : null;
    const loads = (/** @type {any} */ teacher) => h("ul", { class: "space-y-0.5 text-small" }, teacher.loads.map((/** @type {any} */ item) => h("li", null, h("a", { href: `/teacher-loading?section=${item.section_id}`, class: "inline-flex min-h-11 items-center text-brand underline md:min-h-0" }, item.section), `: ${item.subject} (${item.hours_per_week} hrs)`)));

    replace(
      content,
      h("p", { class: "text-sm text-muted-foreground", "aria-live": "polite" }, `${data.summary.teachers} ${data.summary.teachers === 1 ? "teacher" : "teachers"}. A teacher carries at most 5 subjects a term; the hours a week are counted from the subjects.`),
      // Wide screens: a table. Phones: cards.
      h("div", { class: "hidden overflow-x-auto rounded-xl border md:block" },
        h("table", { class: "w-full text-sm" },
          h("thead", { class: "bg-surface-muted text-left text-small text-muted-foreground" }, h("tr", null, ["Teacher", "Subjects and sections", "Load", "Status"].map((title) => h("th", { scope: "col", class: "p-3 font-medium" }, title)))),
          h("tbody", null, teachers.map((teacher) => h("tr", { class: `border-t align-top ${teacher.is_overloaded ? "bg-danger/5" : ""}` },
            h("td", { class: "p-3" }, h("p", { class: "font-medium" }, teacher.name), teacher.department ? h("p", { class: "text-small text-muted-foreground" }, teacher.department) : null),
            h("td", { class: "p-3" }, loads(teacher)),
            h("td", { class: "w-56 p-3" }, bar(teacher)),
            h("td", { class: "p-3" }, status(teacher), fix(teacher)),
          ))),
        ),
      ),
      h("div", { class: "grid gap-3 md:hidden" }, teachers.map((teacher) => h("div", { class: `card space-y-2 p-4 ${teacher.is_overloaded ? "border-danger/40" : ""}` },
        h("div", { class: "flex items-start justify-between gap-2" }, h("div", { class: "min-w-0" }, h("p", { class: "font-semibold text-brand" }, teacher.name), teacher.department ? h("p", { class: "text-small text-muted-foreground" }, teacher.department) : null), status(teacher)),
        bar(teacher), loads(teacher), fix(teacher),
      ))),
    );
  };

  const draw = async () => {
    try {
      await (view === "teachers" ? drawTeachers() : drawSection());
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };

  const stop = watch(["terms", term.id], draw);
  await draw();
  return stop;
}
