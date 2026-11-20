// @ts-check
/**
 * Setup Guide (Admin): the steps before making a schedule, in order, each with its status, a count,
 * what it needs first, and a button to its page or its import (team decision, Nov 21, 2026, after
 * the beneficiary's review: the user should always know the next step). A step whose prerequisite
 * is missing is disabled and says which step to do first.
 *
 * Statuses come from GET endpoints that already exist (the two dashboards and the lists), so there
 * is no new server code for this page.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { skeletonPage } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { openImportPanel } from "@/components/import-panel.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { getAdminDashboard, getSchedulerDashboard } from "@/api/dashboard.js";
import { getRecords } from "@/api/records.js";
import { getSections } from "@/api/schedule.js";
import { invalidate } from "@/state/cache.js";
import { termState, termWord } from "@/state/term.js";
import { openCopyDialog } from "@/features/schedule/list/start-dialogs.js";
import { buildSetupSteps } from "./steps.js";

/**
 * @typedef {import("./steps.js").SetupStep} SetupStep
 * @typedef {import("./steps.js").StepAction} StepAction
 */

/**
 * @param {SetupStep} step
 * @param {boolean} isNext
 * @param {(action: StepAction) => void} onAction
 */
function stepCard(step, isNext, onAction) {
  const blocked = step.blockedBy !== null && !step.done;
  const tone = step.done ? "bg-success text-white" : isNext ? "bg-brand text-white" : "bg-surface-muted";
  return h(
    "li",
    { class: `card p-4 ${isNext ? "border-2 border-brand" : ""}`, "aria-current": isNext ? "step" : undefined },
    h(
      "div",
      { class: "flex items-start gap-3" },
      h("span", { class: `flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tone}`, "aria-hidden": "true" }, step.done ? icon("check") : String(step.number)),
      h(
        "div",
        { class: "min-w-0 flex-1 space-y-2" },
        h(
          "div",
          { class: "flex flex-wrap items-center gap-2" },
          h("h2", { class: "font-semibold" }, h("span", { class: "sr-only" }, `Step ${step.number}: `), step.title),
          h("span", { class: `badge ${step.done ? "bg-success/10 text-success" : blocked ? "bg-surface-muted text-muted-foreground" : "bg-danger/10 text-danger"}` }, step.done ? "Done" : blocked ? "Waiting" : "Missing"),
          step.later ? h("span", { class: "badge bg-surface-muted text-muted-foreground" }, "Can be done later") : null,
          isNext ? h("span", { class: "badge bg-brand-soft text-brand" }, "Next") : null,
        ),
        h("p", { class: "text-sm text-muted-foreground" }, step.detail),
        h("p", { class: `text-sm font-medium ${step.done ? "text-success" : "text-foreground"}` }, step.status),
        blocked ? h("p", { class: "flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-small text-amber-950 dark:bg-amber-950 dark:text-amber-50" }, icon("info", "mt-0.5 size-4 shrink-0"), step.blockedBy) : null,
        h(
          "div",
          { class: "flex flex-wrap gap-2 pt-1" },
          step.actions.map((action) => {
            const classes = `btn ${action.primary && !step.done ? "btn-primary" : "btn-outline"}`;
            if (action.to && !blocked) return h("a", { href: action.to, class: classes }, action.label, icon("arrow-right"));
            return h("button", { type: "button", class: classes, disabled: blocked, title: blocked ? step.blockedBy : undefined, onclick: () => onAction(action) }, action.importType ? icon("file-up") : action.copy ? icon("copy") : null, action.label);
          }),
        ),
      ),
    ),
  );
}

/** @type {import("@/router.js").RenderPage} */
export async function render(container) {
  const term = termState.term;
  const header = pageHeader({ icon: "clipboard", title: "Setup Guide", description: "Everything a schedule needs, in order. Do the next step, or import a whole list from Excel.", crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Setup Guide" }] });

  if (!term) {
    replace(container, h("div", { class: "space-y-5 p-4 sm:p-6" }, header, emptyState({ title: "No school year yet", text: "Step 1 is to start the school year, with its terms and dates.", action: h("a", { href: "/school-years", class: "btn btn-primary" }, icon("calendar"), "Start a school year") })));
    return;
  }

  const otherTerms = termState.terms.filter((other) => other.school_year.id === term.school_year.id && other.id !== term.id);

  const draw = async () => {
    replace(container, skeletonPage());
    try {
      const [admin, scheduler, people, subjectOptions, subjects] = await Promise.all([
        getAdminDashboard(term.id),
        getSchedulerDashboard(term.id),
        getRecords("/personnel-options"),
        getRecords(`/school-years/${term.school_year.id}/subject-options`),
        getRecords(`/school-years/${term.school_year.id}/subjects`),
      ]);
      const steps = buildSetupSteps({
        checklist: admin.checklist,
        steps: scheduler.steps,
        departments: people.departments.length,
        tracks: subjectOptions.tracks.length,
        subjects: subjects.length,
        termLabel: termWord(term),
        hasOtherTerms: otherTerms.length > 0,
      });
      const nextIndex = steps.findIndex((step) => !step.done && !step.later && step.blockedBy === null);
      const doneCount = steps.filter((step) => step.done).length;

      const onAction = async (/** @type {StepAction} */ action) => {
        if (action.importType) {
          openImportPanel({ type: action.importType, schoolYear: term.school_year, onDone: () => { invalidate([]); draw(); } });
        } else if (action.copy) {
          try {
            openCopyDialog({ term, otherTerms, sections: await getSections(term.id) });
          } catch (error) {
            toast.error(error);
          }
        }
      };

      replace(
        container,
        h(
          "div",
          { class: "space-y-5 p-4 sm:p-6" },
          header,
          h(
            "div",
            { class: "card flex flex-wrap items-center justify-between gap-3 p-4" },
            h("div", null, h("p", { class: "font-medium" }, `${doneCount} of ${steps.length} steps done`), h("p", { class: "text-small text-muted-foreground" }, `${term.name}, SY ${term.school_year.name}. Imports take the Excel template; every row is checked before anything is saved.`)),
            h("div", { class: "h-2 w-full overflow-hidden rounded-full bg-surface-muted sm:w-64", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(steps.length), "aria-valuenow": String(doneCount), "aria-label": "Setup progress" }, h("div", { class: "h-full rounded-full bg-success", style: `width: ${Math.round((doneCount / steps.length) * 100)}%` })),
          ),
          h("ol", { class: "space-y-3", "aria-label": "Setup steps" }, steps.map((step, index) => stepCard(step, index === nextIndex, onAction))),
        ),
      );
    } catch (error) {
      replace(container, h("div", { class: "space-y-5 p-4 sm:p-6" }, header, h("p", { class: "rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger", role: "alert" }, errorMessage(error))));
    }
  };

  await draw();
}
