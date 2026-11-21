// @ts-check
/**
 * School Years (Admin): every school year with its terms, the active term, the "Start New School
 * Year" wizard (dates, term structure, review; the name comes from the dates), and Calendar settings to
 * change the structure later. Nothing here assumes 3 terms or the word "Term": both come from
 * the school year.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { confirmAction, openDialog, setBusy } from "@/components/dialog.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { watch } from "@/state/cache.js";
import { loadTerms } from "@/state/term.js";
import { termProblems, yearName, yearProblems } from "@/lib/calendar-rules.js";

export const TERM_PRESETS = [
  { key: "terms", title: "3 Terms", hint: "Current DepEd", count: 3, label: "Term" },
  { key: "semesters", title: "2 Semesters", hint: "Two parts", count: 2, label: "Semester" },
  { key: "quarters", title: "4 Quarters", hint: "Four parts", count: 4, label: "Quarter" },
];
const ORDINALS = ["First", "Second", "Third", "Fourth"];
const DAY_MS = 86_400_000;

/** "First Term", "Second Semester"... */
export const termName = (/** @type {number} */ position, /** @type {string} */ label) => `${ORDINALS[position] ?? `No. ${position + 1}`} ${label}`;

/**
 * Splits the school year evenly into terms, as a start the Admin can edit (in UTC, so a time zone
 * never moves a date).
 * @param {number} count @param {string} label @param {string} start @param {string} end
 */
export function buildTerms(count, label, start, end) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  const hasDates = !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs;
  const totalDays = hasDates ? Math.round((endMs - startMs) / DAY_MS) + 1 : 0;
  const dateAt = (/** @type {number} */ day) => new Date(startMs + day * DAY_MS).toISOString().slice(0, 10);
  return Array.from({ length: count }, (_, index) => ({
    name: termName(index, label),
    start_date: hasDates ? dateAt(Math.floor((index * totalDays) / count)) : "",
    end_date: hasDates ? dateAt(Math.floor(((index + 1) * totalDays) / count) - 1) : "",
  }));
}

/** "2027-06-08" as "08/06/2027 · Tuesday" (day/month/year). */
export function dayMonthYear(/** @type {string} */ date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year} · ${new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}`;
}

const formatDate = (/** @type {string} */ date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * A date field with the day/month/year reading under it, and its own error line. The error is set
 * while the date is chosen (it never waits for Next or Save).
 * @param {string} label @param {string} value @param {(value: string) => void} onChange
 */
function dateField(label, value, onChange) {
  const id = `date-${Math.random().toString(36).slice(2, 8)}`;
  const hint = h("p", { class: "field-help" }, dayMonthYear(value) || "dd/mm/yyyy");
  const error = h("p", { id: `${id}-error`, class: "field-error", role: "alert", hidden: true });
  const input = /** @type {HTMLInputElement} */ (h("input", { id, type: "date", class: "input", value, "aria-describedby": `${id}-error`, oninput: () => { hint.textContent = dayMonthYear(input.value) || "dd/mm/yyyy"; onChange(input.value); } }));
  return Object.assign(h("div", { class: "space-y-1" }, h("label", { class: "field-label", htmlFor: id }, label), input, hint, error), {
    /** @param {string | undefined} message */
    setError(message) {
      error.textContent = message ?? "";
      error.hidden = !message;
      input.setAttribute("aria-invalid", message ? "true" : "false");
      input.classList.toggle("border-danger", !!message);
    },
  });
}

/** A text field bound to a value, with its own error line. */
function textField(/** @type {string} */ label, /** @type {string} */ value, /** @type {(value: string) => void} */ onChange) {
  const id = `text-${Math.random().toString(36).slice(2, 8)}`;
  const error = h("p", { class: "field-error", role: "alert", hidden: true });
  const input = /** @type {HTMLInputElement} */ (h("input", { id, class: "input", value, oninput: () => onChange(input.value.trim()) }));
  return Object.assign(h("div", { class: "space-y-1" }, h("label", { class: "field-label", htmlFor: id }, label), input, error), {
    /** @param {string | undefined} message */
    setError(message) {
      error.textContent = message ?? "";
      error.hidden = !message;
      input.setAttribute("aria-invalid", message ? "true" : "false");
      input.classList.toggle("border-danger", !!message);
    },
  });
}

/**
 * The term rows (name, start, end) with their errors, checked on every change.
 * @param {{ name: string, start_date: string, end_date: string, cannot_remove_reason?: string | null }[]} terms
 * @param {() => void} onChange
 */
function termRows(terms, onChange) {
  return terms.map((term, index) => {
    const name = textField(`Name of part ${index + 1}`, term.name, (value) => { term.name = value; onChange(); });
    const start = dateField("Starts", term.start_date, (value) => { term.start_date = value; onChange(); });
    const end = dateField("Ends", term.end_date, (value) => { term.end_date = value; onChange(); });
    return { element: h("div", { class: "grid gap-3 rounded-lg border p-3 sm:grid-cols-3" }, name, start, end), fields: { name, start_date: start, end_date: end } };
  });
}

/**
 * Shows each problem under its field, and says whether everything is right.
 * @param {{ fields: Record<string, { setError: (message: string | undefined) => void }> }[]} rows
 * @param {ReturnType<typeof termProblems>} problems
 */
function showTermProblems(rows, problems) {
  rows.forEach((row, index) => {
    for (const [field, control] of Object.entries(row.fields)) control.setError(problems.find((problem) => problem.index === index && problem.field === field)?.message);
  });
  return problems.length === 0;
}

/** @type {import("@/router.js").RenderPage} */
export async function render(container) {
  const content = h("div", { class: "space-y-4" }, skeletonList(3));
  /** @type {any[]} */
  let years = [];

  /**
   * Start a new school year in three steps: dates, terms, review. The name comes from the first day
   * (2026 → "2026-2027"), and every rule is checked while the dates are chosen, so a mistake shows
   * at once and Next waits until it is fixed. Subjects, class hours and signatories of the latest
   * school year are copied (beneficiary review, Nov 21, 2026: no "what to copy" step).
   */
  const startYearWizard = () => {
    const latest = years[0];
    const draft = { start_date: "", end_date: "", preset: "terms", label: "Term", count: 3, terms: /** @type {any[]} */ ([]) };
    let step = 1;
    const body = h("div", { class: "space-y-4" });
    const back = h("button", { type: "button", class: "btn btn-outline", onclick: () => { step -= 1; draw(); } }, icon("arrow-left"), "Back");
    const next = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", onclick: () => go() }, "Next"));
    /** Fields the user has changed show their problem at once; the others after Next is pressed. */
    const touched = new Set();
    /** @type {() => boolean} */
    let check = () => true;

    const go = async () => {
      touched.add("all");
      if (!check()) {
        toast.error("Fix what is marked in red first.");
        return;
      }
      if (step === 1 && draft.terms.length === 0) draft.terms = buildTerms(draft.count, draft.label, draft.start_date, draft.end_date);
      if (step < 3) {
        step += 1;
        touched.clear();
        draw();
        return;
      }
      setBusy(next, true, "Starting...");
      try {
        const name = yearName(draft.start_date);
        const reply = await changeRecord("/school-years", "POST", { name, start_date: draft.start_date, end_date: draft.end_date, term_label: draft.label, terms: draft.terms, copy_from_id: latest?.id ?? null, copy: { subjects: true, time_slots: true, signatories: true, section_names: false } });
        const copied = reply.copied ?? {};
        const lines = [copied.subjects ? `${copied.subjects} subjects` : "", copied.day_patterns ? `${copied.day_patterns} class hours` : "", copied.signatories ? "the signatories" : ""].filter(Boolean);
        await loadTerms();
        toast.success(`SY ${name} was started${lines.length ? `, with ${lines.join(", ")} copied from SY ${latest.name}` : ""}. Make one of its terms active when it begins.`);
        close();
      } catch (error) {
        toast.error(error);
        setBusy(next, false);
      }
    };

    const draw = () => {
      back.hidden = step === 1;
      next.textContent = step === 3 ? "Start the school year" : "Next";
      const steps = ["Dates", "Terms", "Review"];
      const header = h("ol", { class: "grid grid-cols-3 gap-1 text-center text-small" }, steps.map((title, index) => h("li", { class: `rounded-lg px-1 py-2 ${index + 1 === step ? "bg-brand text-white" : index + 1 < step ? "bg-brand-soft text-brand" : "bg-surface-muted text-muted-foreground"}`, "aria-current": index + 1 === step ? "step" : null }, `${index + 1}. ${title}`)));
      if (step === 1) {
        const nameLine = h("p", { class: "rounded-lg bg-surface-muted p-3 text-sm" });
        const showName = () => replace(nameLine, draft.start_date ? h("span", null, "School year: ", h("strong", null, `SY ${yearName(draft.start_date)}`), " (made from the first day)") : "The school year's name is made from the first day, like 2026-2027.");
        const startField = dateField("First day", draft.start_date, (value) => { draft.start_date = value; draft.terms = []; touched.add("start_date"); showName(); check(); });
        const endField = dateField("Last day", draft.end_date, (value) => { draft.end_date = value; draft.terms = []; touched.add("end_date"); check(); });
        check = () => {
          const problems = yearProblems(draft, years);
          const ok = !problems.start_date && !problems.end_date;
          // Nothing is shown before a date is chosen; after that, every problem at once.
          const isShown = touched.size > 0;
          startField.setError(isShown ? problems.start_date : undefined);
          endField.setError(isShown ? problems.end_date : undefined);
          next.disabled = isShown && !ok;
          return ok;
        };
        showName();
        replace(body, header, nameLine, h("div", { class: "grid gap-4 sm:grid-cols-2" }, startField, endField), h("p", { class: "field-help" }, "A school year is one year at most, and must not overlap another."));
        next.disabled = false;
      } else if (step === 2) {
        const termsArea = h("div", { class: "space-y-3" });
        /** @type {ReturnType<typeof termRows>} */
        let rows = [];
        check = () => {
          const ok = showTermProblems(rows, termProblems(draft.terms, draft));
          next.disabled = !ok;
          return ok;
        };
        const drawTerms = () => {
          rows = termRows(draft.terms, () => check());
          replace(termsArea, rows.map((row) => row.element));
          check();
        };
        const presetButtons = h("div", { class: "grid gap-2 sm:grid-cols-4" }, [...TERM_PRESETS, { key: "custom", title: "Custom", hint: "Your own", count: draft.count, label: draft.label }].map((preset) =>
          h("button", { type: "button", "aria-pressed": String(draft.preset === preset.key), class: `card flex min-h-16 flex-col items-start justify-center p-3 text-left ${draft.preset === preset.key ? "border-brand bg-brand text-white" : "hover:border-brand"}`, onclick: () => { draft.preset = preset.key; if (preset.key !== "custom") { draft.count = preset.count; draft.label = preset.label; } draft.terms = buildTerms(draft.count, draft.label, draft.start_date, draft.end_date); draw(); } }, h("span", { class: "font-semibold" }, preset.title), h("span", { class: "text-small opacity-80" }, preset.hint)),
        ));
        replace(
          body,
          header,
          presetButtons,
          draft.preset === "custom" ? h("div", { class: "grid gap-4 sm:grid-cols-2" }, textField("What a part is called", draft.label, (value) => { draft.label = value || "Term"; }), h("div", { class: "space-y-1" }, h("label", { class: "field-label" }, "How many parts"), h("div", { class: "flex gap-2" }, [1, 2, 3, 4].map((count) => h("button", { type: "button", "aria-pressed": String(draft.count === count), class: `btn border ${draft.count === count ? "border-brand bg-brand text-white" : "bg-surface"}`, onclick: () => { draft.count = count; draft.terms = buildTerms(count, draft.label, draft.start_date, draft.end_date); draw(); } }, String(count)))))) : null,
          h("p", { class: "field-help" }, `The dates are split evenly to start with. Each part lies inside SY ${yearName(draft.start_date)}, one after another, and lasts at least 2 months.`),
          termsArea,
        );
        drawTerms();
      } else {
        check = () => true;
        next.disabled = false;
        replace(body, header, h("dl", { class: "grid gap-x-4 gap-y-2 rounded-lg border p-3 text-sm sm:grid-cols-3" },
          h("dt", { class: "text-muted-foreground" }, "School year"), h("dd", { class: "font-medium sm:col-span-2" }, `SY ${yearName(draft.start_date)}: ${dayMonthYear(draft.start_date)} to ${dayMonthYear(draft.end_date)}`),
          h("dt", { class: "text-muted-foreground" }, `${draft.label}s`), h("dd", { class: "sm:col-span-2" }, h("ul", null, draft.terms.map((term) => h("li", null, `${term.name}: ${formatDate(term.start_date)} – ${formatDate(term.end_date)}`)))),
          h("dt", { class: "text-muted-foreground" }, "Copied"), h("dd", { class: "sm:col-span-2" }, latest ? `Subjects, class hours and signatories of SY ${latest.name}` : "Nothing: this is the first school year"),
        ), h("p", { class: "field-help" }, "Everything is saved together. Teachers stay from year to year; add this year's sections after. The current active term stays active until you switch."));
      }
    };

    const { close } = openDialog({ title: "Start a new school year", size: "lg", body, footer: [h("button", { type: "button", class: "btn btn-outline sm:mr-auto", onclick: () => close() }, "Cancel"), back, next] });
    draw();
  };

  /** Calendar settings: change the dates and terms of a school year, checked while they are chosen. */
  const calendarSettings = (/** @type {any} */ year) => {
    const draft = { start_date: year.start_date, end_date: year.end_date, label: year.term_label, terms: year.terms.map((/** @type {any} */ term) => ({ ...term })) };
    const body = h("div", { class: "space-y-4" });
    /** @type {ReturnType<typeof termRows>} */
    let rows = [];
    /** @type {ReturnType<typeof dateField>} */
    let startField;
    /** @type {ReturnType<typeof dateField>} */
    let endField;
    const nameLine = h("p", { class: "rounded-lg bg-surface-muted p-3 text-sm" });
    const check = () => {
      const problems = yearProblems(draft, years, year.id);
      startField.setError(problems.start_date);
      endField.setError(problems.end_date);
      replace(nameLine, "School year: ", h("strong", null, `SY ${yearName(draft.start_date) || year.name}`), " (made from the first day)");
      const ok = showTermProblems(rows, termProblems(draft.terms, draft)) && !problems.start_date && !problems.end_date;
      save.disabled = !ok;
      return ok;
    };
    const draw = () => {
      startField = dateField("First day", draft.start_date, (value) => { draft.start_date = value; check(); });
      endField = dateField("Last day", draft.end_date, (value) => { draft.end_date = value; check(); });
      rows = termRows(draft.terms, () => check());
      replace(
        body,
        nameLine,
        h("div", { class: "grid gap-4 sm:grid-cols-3" }, textField("What a part is called", draft.label, (value) => (draft.label = value || "Term")), startField, endField),
        rows.map((row, index) => h("div", { class: "space-y-2" },
          row.element,
          // Parts are kept in order, so only the last one can be removed.
          index === draft.terms.length - 1 && draft.terms.length > 1 ? h("button", { type: "button", class: "btn btn-outline text-danger", disabled: !!draft.terms[index].cannot_remove_reason, title: draft.terms[index].cannot_remove_reason ?? undefined, onclick: () => { draft.terms.pop(); draw(); } }, icon("trash"), "Remove this part") : null,
          index === draft.terms.length - 1 && draft.terms[index].cannot_remove_reason ? h("p", { class: "field-help" }, `It cannot be removed: ${draft.terms[index].cannot_remove_reason}`) : null,
        )),
        draft.terms.length < 4 ? h("button", { type: "button", class: "btn btn-outline", onclick: () => { draft.terms.push({ name: termName(draft.terms.length, draft.label), start_date: "", end_date: "" }); draw(); } }, icon("plus"), "Add a part") : null,
      );
      check();
    };
    const save = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", onclick: async () => {
      if (!check()) {
        toast.error("Fix what is marked in red first.");
        return;
      }
      setBusy(save, true);
      const name = yearName(draft.start_date);
      try {
        await changeRecord(`/school-years/${year.id}`, "PUT", { name, start_date: draft.start_date, end_date: draft.end_date, term_label: draft.label, terms: draft.terms.map((/** @type {any} */ term) => ({ name: term.name, start_date: term.start_date, end_date: term.end_date })) });
        await loadTerms();
        toast.success(`SY ${name} was saved.`);
        close();
      } catch (error) {
        toast.error(error);
        setBusy(save, false);
      }
    } }, "Save changes"));
    const remove = h("button", { type: "button", class: "btn btn-outline text-danger sm:mr-auto", disabled: !!year.cannot_delete_reason, title: year.cannot_delete_reason ?? undefined, onclick: async () => {
      if (!(await confirmAction({ title: `Delete SY ${year.name}?`, message: "Its terms, subjects, class hours and signatories are deleted.", confirmLabel: "Yes, delete" }))) return;
      try {
        await changeRecord(`/school-years/${year.id}`, "DELETE");
        await loadTerms();
        toast.success(`SY ${year.name} was deleted.`);
        close();
      } catch (error) {
        toast.error(error);
      }
    } }, icon("trash"), "Delete");
    const { close } = openDialog({ title: `Calendar settings · SY ${year.name}`, description: "A part that already has schedules cannot be removed.", size: "lg", body, footer: [remove, h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"), save] });
    draw();
  };

  const activate = async (/** @type {any} */ term) => {
    if (!(await confirmAction({ title: `Make ${term.name} active?`, message: "Everyone works on the active term by default, and the Guest view shows its approved schedules.", confirmLabel: "Yes, make it active", danger: false }))) return;
    try {
      await changeRecord(`/terms/${term.id}/activate`, "PUT");
      await loadTerms();
      toast.success(`${term.name} is now the active term.`);
    } catch (error) {
      toast.error(error);
    }
  };

  replace(container, h("div", { class: "space-y-5 p-4 sm:p-6" }, pageHeader({ icon: "calendar", title: "School Years", description: "Each school year with its terms. Only one term is active.", crumbs: [{ label: "Home", to: "/dashboard" }, { label: "School Years" }], actions: h("button", { type: "button", class: "btn btn-primary", onclick: () => startYearWizard() }, icon("plus"), "Start a new school year") }), content));

  const draw = async () => {
    try {
      years = await getRecords("/school-years");
      replace(
        content,
        years.length === 0
          ? emptyState({ title: "No school year yet", text: "Start the first school year: its name, dates and terms.", action: h("button", { type: "button", class: "btn btn-primary", onclick: () => startYearWizard() }, icon("plus"), "Start a new school year") })
          : years.map((year) =>
              h("section", { "aria-label": `SY ${year.name}`, class: "card space-y-3 p-4" },
                h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between" },
                  h("div", null, h("h2", { class: "text-lg font-semibold text-accent" }, `SY ${year.name}`), h("p", { class: "text-small text-muted-foreground" }, `${formatDate(year.start_date)} – ${formatDate(year.end_date)} · ${year.term_count} ${year.term_label.toLowerCase()}${year.term_count === 1 ? "" : "s"} · ${year.counts.subjects} subjects, ${year.counts.sections} sections`)),
                  h("button", { type: "button", class: "btn btn-outline", onclick: () => calendarSettings(year) }, icon("file-cog"), "Calendar settings"),
                ),
                h("ul", { class: "grid gap-2 sm:grid-cols-2 xl:grid-cols-4" }, year.terms.map((/** @type {any} */ term) =>
                  h("li", { class: `space-y-2 rounded-lg border p-3 ${term.is_active ? "border-brand bg-brand-soft" : ""}` },
                    h("p", { class: "font-medium" }, term.name), h("p", { class: "text-small text-muted-foreground" }, `${formatDate(term.start_date)} – ${formatDate(term.end_date)}`),
                    term.is_active ? h("span", { class: "badge bg-brand text-white" }, "Active") : h("button", { type: "button", class: "btn btn-outline w-full", onclick: () => activate(term) }, "Make active"),
                  ),
                )),
              ),
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
