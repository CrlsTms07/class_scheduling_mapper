// @ts-check
/**
 * Approvals: the Admin reviews what the Chairpersons and the Master Teacher submitted, one
 * section from its row, or everything the department and grade filters show at once. A summary
 * comes before every action: how many sections and classes, and which have flags.
 */
import { h, replace, uid } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { openDialog, setBusy } from "@/components/dialog.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { APPROVAL_TABS, entriesFor, getApprovals, reviewSchedules, sectionsFor } from "@/api/approvals.js";
import { watch } from "@/state/cache.js";
import { termState } from "@/state/term.js";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/schedule.js";

/** @typedef {import("@/api/approvals.js").ApprovalSection} ApprovalSection */
/** @typedef {import("@/api/approvals.js").ReviewAction} ReviewAction */

const WORDS = {
  approve: { title: "Approve schedules", button: "Approve", remarks: "Remarks (optional)", done: "Approved" },
  reject: { title: "Reject schedules", button: "Reject", remarks: "Reason for rejecting (the Chairperson sees it)", done: "Rejected" },
  reopen: { title: "Reopen schedules", button: "Reopen", remarks: "Reason for reopening (the Chairperson sees it)", done: "Reopened" },
};

/** @type {import("@/router.js").RenderPage} */
export async function render(container) {
  const term = termState.term;
  if (!term) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "Start a school year on the School Years page." })));
    return;
  }

  /** @type {{ tab: string, level: "" | "JHS" | "SHS", gradeLevelId: number | null, search: string }} */
  const ui = { tab: "pending", level: "", gradeLevelId: null, search: "" };
  /** @type {ApprovalSection[]} */
  let sections = [];

  const kpis = h("div", { class: "grid grid-cols-2 gap-3 xl:grid-cols-4" });
  const filters = h("div", { class: "card space-y-4 p-4" });
  const list = h("div", { class: "space-y-3" }, skeletonList(4));
  const searchInput = /** @type {HTMLInputElement} */ (h("input", { type: "search", class: "input pl-10", placeholder: "Section or adviser", "aria-label": "Search sections or advisers", oninput: () => { ui.search = searchInput.value; drawList(); } }));

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "circle-check", title: "Approvals", description: `Review the schedules submitted by the Chairpersons and the Master Teacher for ${term.name}, SY ${term.school_year.name}.`, crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Approvals" }] }),
      kpis,
      filters,
      list,
    ),
  );

  const inScope = () => sections.filter((section) => (!ui.level || section.level === ui.level) && (!ui.gradeLevelId || section.grade_level_id === ui.gradeLevelId));

  const scope = () => {
    const grades = gradeOptions();
    if (ui.gradeLevelId) return { label: `Grade ${grades.find(({ value }) => value === ui.gradeLevelId)?.grade}`, input: /** @type {const} */ ({ scope: "grade_level", scope_ref_id: ui.gradeLevelId }) };
    if (ui.level) return { label: `All ${ui.level}`, input: /** @type {const} */ ({ scope: ui.level }) };
    return { label: "All sections", input: /** @type {const} */ ({ scope: "all" }) };
  };

  const gradeOptions = () =>
    [...new Map(sections.filter((section) => !ui.level || section.level === ui.level).map((section) => [section.grade_level_id, section.grade])).entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([value, grade]) => ({ value, grade, label: `Grade ${grade}` }));

  /**
   * The summary before an action, with remarks (required to reject or reopen).
   * @param {ReviewAction} action
   * @param {string} label
   * @param {import("@/api/approvals.js").ReviewScope} input
   * @param {ApprovalSection[]} reached
   */
  const openReview = (action, label, input, reached) => {
    const words = WORDS[action];
    const targets = sectionsFor(reached, action);
    const entries = entriesFor(reached, action);
    const flagged = action === "reopen" ? [] : targets.filter(({ flags }) => flags.length > 0);
    const remarksId = uid("remarks");
    const remarks = /** @type {HTMLTextAreaElement} */ (h("textarea", { id: remarksId, rows: 3, class: "input py-2", oninput: () => { confirm.disabled = action !== "approve" && remarks.value.trim() === ""; } }));
    const confirm = /** @type {HTMLButtonElement} */ (
      h("button", {
        type: "button",
        class: `btn ${action === "reject" ? "btn-danger" : "btn-primary"}`,
        disabled: action !== "approve",
        onclick: async () => {
          setBusy(confirm, true);
          try {
            const result = await reviewSchedules(term.id, { ...input, action, remarks: remarks.value.trim() || undefined });
            toast.success(`${words.done} ${result.entries} classes in ${result.sections} ${result.sections === 1 ? "section" : "sections"}.`);
            close();
          } catch (error) {
            toast.error(error);
            setBusy(confirm, false);
          }
        },
      }, `${words.button} ${targets.length} ${targets.length === 1 ? "section" : "sections"}`)
    );

    const { close } = openDialog({
      title: words.title,
      description: `${label}: ${targets.length} ${targets.length === 1 ? "section" : "sections"}, ${entries} classes.`,
      body: h(
        "div",
        { class: "space-y-4" },
        h("ul", { class: "max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm" }, targets.map(({ label: name }) => h("li", null, name))),
        flagged.length ? h("div", { class: "rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" }, h("p", { class: "font-medium" }, "These sections have flags. Check them before approving:"), h("p", null, flagged.map(({ label: name }) => name).join(", "))) : null,
        h("div", { class: "space-y-1" }, h("label", { class: "field-label", htmlFor: remarksId }, words.remarks), remarks),
      ),
      footer: [h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"), confirm],
    });
  };

  const drawKpis = () => {
    const scoped = inScope();
    const pending = scoped.filter(({ pending_count: count }) => count > 0);
    const approved = scoped.filter(({ approved_count: count }) => count > 0);
    const flagged = pending.filter(({ flags }) => flags.length > 0);
    const notSubmitted = scoped.filter(APPROVAL_TABS[2].includes);
    const sum = (/** @type {ApprovalSection[]} */ items, /** @type {"pending_count" | "approved_count"} */ key) => items.reduce((total, item) => total + item[key], 0);
    const card = (/** @type {import("@/components/icons.js").IconName} */ iconName, /** @type {string} */ tone, /** @type {string} */ label, /** @type {number} */ value, /** @type {string} */ note) =>
      h("div", { class: "card flex items-start gap-3 p-4" }, h("div", { class: `flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}` }, icon(iconName, "size-5")), h("div", { class: "min-w-0" }, h("p", { class: "text-small text-muted-foreground" }, label), h("p", { class: "text-2xl font-bold" }, String(value)), h("p", { class: "text-small text-muted-foreground" }, note)));
    replace(
      kpis,
      card("clock", "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100", "Waiting for review", pending.length, `${sum(pending, "pending_count")} classes`),
      card("circle-check", "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100", "Approved", approved.length, `${sum(approved, "approved_count")} classes`),
      card("warning", "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100", "Pending with flags", flagged.length, flagged.length ? "Check before approving" : "Nothing to check"),
      card("pencil", "bg-surface-muted text-muted-foreground", "Not submitted", notSubmitted.length, "Still being prepared"),
    );
  };

  const drawFilters = () => {
    const scoped = inScope();
    const pending = scoped.filter(({ pending_count: count }) => count > 0);
    const approved = scoped.filter(({ approved_count: count }) => count > 0);
    const flagged = pending.filter(({ flags }) => flags.length > 0);
    const notSubmitted = scoped.filter(APPROVAL_TABS[2].includes);
    const { label, input } = scope();

    replace(
      filters,
      h(
        "div",
        { role: "tablist", "aria-label": "Show", class: "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-2xl" },
        APPROVAL_TABS.map(({ key, label: tabLabel, includes }) => h("button", { type: "button", role: "tab", "aria-selected": String(ui.tab === key), class: `btn border px-2 ${ui.tab === key ? "border-brand bg-brand text-white" : "bg-surface"}`, onclick: () => { ui.tab = key; drawFilters(); drawList(); } }, `${tabLabel} (${scoped.filter(includes).length})`)),
      ),
      h(
        "div",
        { class: "grid gap-3 sm:grid-cols-3" },
        searchableSelect({ label: "Department", value: ui.level, options: [{ value: "", label: "All departments" }, { value: "JHS", label: "Junior High School" }, { value: "SHS", label: "Senior High School" }], onChange: (value) => { ui.level = /** @type {any} */ (value); ui.gradeLevelId = null; drawAll(); } }),
        searchableSelect({ label: "Grade level", value: ui.gradeLevelId ?? "", options: [{ value: "", label: "All grades" }, ...gradeOptions()], onChange: (value) => { ui.gradeLevelId = value ? Number(value) : null; drawAll(); } }),
        h("div", { class: "space-y-1" }, h("label", { class: "field-label" }, "Search"), h("div", { class: "relative" }, h("span", { class: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" }, icon("search")), searchInput)),
      ),
      h(
        "div",
        { class: "flex flex-col gap-3 rounded-lg border bg-surface-muted p-3 lg:flex-row lg:items-center lg:justify-between" },
        h("p", { class: "text-sm" }, h("strong", null, `${label}: `), `${pending.length} waiting for review${flagged.length ? `, ${flagged.length} with flags` : ""}.`),
        h(
          "div",
          { class: "flex flex-col gap-2 sm:flex-row" },
          h("button", { type: "button", class: "btn btn-primary", disabled: pending.length === 0, onclick: () => openReview("approve", label, input, scoped) }, icon("check"), pending.length ? `Approve ${pending.length} pending` : "Approve"),
          h("button", { type: "button", class: "btn btn-outline text-danger", disabled: pending.length === 0, onclick: () => openReview("reject", label, input, scoped) }, icon("x"), pending.length ? `Reject ${pending.length} pending` : "Reject"),
          h("button", { type: "button", class: "btn btn-outline", disabled: approved.length === 0, onclick: () => openReview("reopen", label, input, scoped) }, icon("pencil"), approved.length ? `Reopen ${approved.length} approved` : "Reopen"),
        ),
      ),
      notSubmitted.length && pending.length ? h("p", { class: "flex gap-2 text-small text-warning" }, icon("warning", "size-4 shrink-0"), `Not included because they are not submitted yet: ${notSubmitted.map(({ label: name }) => name).join(", ")}`) : null,
    );
  };

  /** @param {ApprovalSection} section */
  const flagSummary = (section) => {
    if (section.flags.length === 0) return h("span", { class: "text-small text-muted-foreground" }, "No flags");
    const acknowledged = section.flags.filter(({ acknowledged: isAcknowledged }) => isAcknowledged).length;
    return h(
      "details",
      { class: "text-sm" },
      h("summary", { class: "flex min-h-11 cursor-pointer items-center gap-1 text-warning" }, icon("warning"), `${section.flags.length} ${section.flags.length === 1 ? "flag" : "flags"}${acknowledged ? ` (${acknowledged} acknowledged)` : ""}`),
      h("ul", { class: "list-disc space-y-1 pl-5 text-small" }, section.flags.map((flag) => h("li", null, flag.message, flag.acknowledged ? " (acknowledged)" : ""))),
    );
  };

  /** @param {ApprovalSection} section */
  const rowActions = (section) => {
    const one = /** @type {const} */ ({ scope: "section", scope_ref_id: section.id });
    return h(
      "div",
      { class: "flex flex-wrap gap-2" },
      h("a", { href: `/schedule/sections/${section.id}`, class: "btn btn-outline" }, "View"),
      section.pending_count > 0 ? h("button", { type: "button", class: "btn btn-primary", "aria-label": `Approve ${section.label}`, onclick: () => openReview("approve", section.label, one, [section]) }, "Approve") : null,
      section.pending_count > 0 ? h("button", { type: "button", class: "btn btn-outline text-danger", "aria-label": `Reject ${section.label}`, onclick: () => openReview("reject", section.label, one, [section]) }, "Reject") : null,
      section.approved_count > 0 && section.pending_count === 0 ? h("button", { type: "button", class: "btn btn-outline", "aria-label": `Reopen ${section.label}`, onclick: () => openReview("reopen", section.label, one, [section]) }, "Reopen") : null,
    );
  };

  const drawList = () => {
    const words = ui.search.trim().toLowerCase();
    const tab = APPROVAL_TABS.find(({ key }) => key === ui.tab) ?? APPROVAL_TABS[0];
    const shown = inScope().filter((section) => tab.includes(section) && (!words || section.label.toLowerCase().includes(words) || (section.adviser ?? "").toLowerCase().includes(words)));

    if (sections.length === 0) {
      replace(list, emptyState({ title: "No sections yet", text: "There are no sections in this school year yet." }));
      return;
    }
    if (shown.length === 0) {
      replace(list, h("p", { class: "text-sm text-muted-foreground" }, ui.tab === "pending" ? "Nothing is waiting for review here." : "No section matches what is chosen above."));
      return;
    }

    replace(
      list,
      h(
        "div",
        { class: "hidden overflow-x-auto rounded-xl border md:block" },
        h(
          "table",
          { class: "w-full text-sm" },
          h("thead", { class: "bg-surface-muted text-left text-small text-muted-foreground" }, h("tr", null, ["Section", "Status", "Classes", "Flags", "Actions"].map((title) => h("th", { scope: "col", class: "p-3 font-medium" }, title)))),
          h("tbody", null, shown.map((section) => h("tr", { class: "border-t align-top" },
            h("td", { class: "p-3" }, h("p", { class: "font-medium" }, section.label), h("p", { class: "text-small text-muted-foreground" }, `${section.level} · Adviser: ${section.adviser ?? "None yet"}`)),
            h("td", { class: "p-3" }, h("span", { class: `badge ${STATUS_COLORS[section.status]}` }, STATUS_LABELS[section.status])),
            h("td", { class: "p-3 text-small" }, section.pending_count ? h("p", null, `${section.pending_count} pending`) : null, section.approved_count ? h("p", null, `${section.approved_count} approved`) : null, section.pending_count + section.approved_count === 0 ? "–" : null),
            h("td", { class: "p-3" }, flagSummary(section)),
            h("td", { class: "p-3" }, rowActions(section)),
          ))),
        ),
      ),
      h("div", { class: "grid gap-3 md:hidden" }, shown.map((section) => h("div", { class: "card space-y-2 p-4" },
        h("div", { class: "flex items-start justify-between gap-2" }, h("div", { class: "min-w-0" }, h("p", { class: "font-semibold text-brand" }, section.label), h("p", { class: "text-small text-muted-foreground" }, `Adviser: ${section.adviser ?? "None yet"}`)), h("span", { class: `badge shrink-0 ${STATUS_COLORS[section.status]}` }, STATUS_LABELS[section.status])),
        flagSummary(section),
        rowActions(section),
      ))),
    );
  };

  const drawAll = () => {
    drawKpis();
    drawFilters();
    drawList();
  };

  const loadAll = async () => {
    try {
      sections = await getApprovals(term.id);
      drawAll();
    } catch (error) {
      replace(list, h("p", { role: "alert", class: "text-danger" }, `Could not load the schedules. ${errorMessage(error)}`));
    }
  };

  const stop = watch(["terms", term.id], loadAll);
  await loadAll();
  return stop;
}
