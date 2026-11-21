// @ts-check
/**
 * Subjects and Class Hours are one setup step (team decision, Nov 21, 2026): two tabs of the same
 * module, under a small stepper that says what to do here and what comes next.
 */
import { h } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";

const STEPS = [
  { key: "subjects", title: "List the subjects", text: "Just their names.", href: "/subjects", icon: /** @type {const} */ ("book") },
  { key: "hours", title: "Set the class hours", text: "Periods and breaks. Optional: times can be typed while plotting.", href: "/time-slots", icon: /** @type {const} */ ("clock") },
  { key: "next", title: "Next: Sections", text: "Then give each subject its teacher in Teacher Loading.", href: "/sections", icon: /** @type {const} */ ("arrow-right") },
];

/**
 * @param {"subjects" | "hours"} active
 */
export function subjectTabs(active) {
  const activeIndex = STEPS.findIndex((step) => step.key === active);
  return h(
    "nav",
    { "aria-label": "Subjects and class hours", class: "card p-2" },
    h(
      "ol",
      { class: "grid gap-1 sm:grid-cols-3" },
      STEPS.map((step, index) => {
        const isActive = index === activeIndex;
        const isNext = step.key === "next";
        return h(
          "li",
          { class: "relative" },
          h(
            "a",
            {
              href: step.href,
              "aria-current": isActive ? "page" : undefined,
              class: `flex h-full min-h-16 items-start gap-3 rounded-lg p-3 transition-colors ${isActive ? "bg-brand-soft" : "hover:bg-surface-muted"}`,
            },
            h(
              "span",
              { class: `flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isActive ? "bg-brand text-white" : isNext ? "border border-dashed text-muted-foreground" : "bg-surface-muted text-foreground"}`, "aria-hidden": "true" },
              isNext ? icon(step.icon, "size-4") : String(index + 1),
            ),
            h(
              "span",
              { class: "min-w-0" },
              h("span", { class: `block text-sm font-semibold ${isActive ? "text-brand" : isNext ? "text-muted-foreground" : ""}` }, step.title),
              h("span", { class: "block text-small text-muted-foreground" }, step.text),
            ),
          ),
          // A thin line between the steps on wide screens.
          index < STEPS.length - 1 ? h("span", { class: "pointer-events-none absolute right-0 top-1/2 hidden h-8 w-px -translate-y-1/2 bg-border sm:block", "aria-hidden": "true" }) : null,
        );
      }),
    ),
  );
}
