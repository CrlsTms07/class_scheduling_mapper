// @ts-check
/**
 * "How to make a schedule": every step in order, who does it, and a link to where it is done.
 * The user's own steps are marked "You" and link straight to their page.
 */
import { h } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { pageHeader } from "@/components/page-header.js";
import { session } from "@/state/session.js";
import { SCHEDULE_GUIDE } from "./schedule-guide.js";

/** Each step's number across all parts (1, 2, 3...), counted once. */
const STEP_NUMBERS = new Map(SCHEDULE_GUIDE.flatMap(({ steps }) => steps).map((step, index) => [step, index + 1]));

/** @type {import("@/router.js").RenderPage} */
export function render(container) {
  const role = session.user?.role ?? "";
  container.append(
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "book", title: "How to make a schedule", description: 'From the start of the school year to the printed Class Program, step by step. Steps marked "You" are yours.', crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Schedule", to: "/schedule" }, { label: "How to make a schedule" }], actions: h("button", { type: "button", class: "btn btn-outline no-print", onclick: () => window.print() }, icon("printer"), "Print this guide") }),
      SCHEDULE_GUIDE.map((part) =>
        h("section", { "aria-label": part.title, class: "space-y-3" },
          h("div", null, h("h2", { class: "font-semibold text-accent" }, part.title), h("p", { class: "text-sm text-muted-foreground" }, part.intro)),
          h("ol", { class: "space-y-3" }, part.steps.map((step) => {
            const number = STEP_NUMBERS.get(step) ?? 0;
            const isMine = step.roles.includes(role);
            return h("li", { class: `card break-inside-avoid p-4 ${isMine ? "border-brand/50" : ""}` },
              h("div", { class: "flex items-start gap-3" },
                h("span", { class: `flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isMine ? "bg-brand text-white" : "bg-surface-muted"}`, "aria-hidden": "true" }, String(number)),
                h("div", { class: "min-w-0 flex-1 space-y-2" },
                  h("div", { class: "flex flex-wrap items-center gap-2" }, h("h3", { class: "font-medium" }, h("span", { class: "sr-only" }, `Step ${number}: `), step.title), isMine ? h("span", { class: "badge bg-brand-soft text-brand" }, "You") : null, step.roles.length === 1 ? h("span", { class: "badge bg-surface-muted" }, "Admin") : null),
                  h("ul", { class: "list-disc space-y-1 pl-5 text-sm" }, step.what.map((line) => h("li", null, line))),
                  step.tip ? h("p", { class: "flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-small text-amber-950 dark:bg-amber-950 dark:text-amber-50" }, icon("info", "mt-0.5 size-4 shrink-0"), step.tip) : null,
                  step.where && isMine ? h("a", { href: step.where.to, class: "btn btn-quiet no-print -ml-2 text-brand" }, `Go to ${step.where.label}`, icon("arrow-right")) : null,
                  step.where && !isMine ? h("p", { class: "text-small text-muted-foreground" }, `Done on the ${step.where.label} page.`) : null,
                ),
              ),
            );
          })),
        ),
      ),
    ),
  );
}
