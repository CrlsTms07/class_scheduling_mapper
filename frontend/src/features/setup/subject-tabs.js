// @ts-check
/**
 * Subjects and Class Hours are one setup step (team decision, Nov 21, 2026): two tabs of the same
 * module, with a short "what to do here" guide for the one making the schedule.
 */
import { h } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";

/**
 * @param {"subjects" | "hours"} active
 */
export function subjectTabs(active) {
  const tab = (/** @type {"subjects" | "hours"} */ key, /** @type {string} */ href, /** @type {string} */ label, /** @type {import("@/components/icons.js").IconName} */ iconName) =>
    h("a", { href, role: "tab", "aria-selected": String(active === key), class: `btn ${active === key ? "bg-surface shadow-sm" : "text-muted-foreground"}` }, icon(iconName), label);
  return h(
    "div",
    { class: "space-y-3" },
    h("div", { role: "tablist", "aria-label": "Subjects and class hours", class: "grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1 sm:flex sm:w-fit" }, tab("subjects", "/subjects", "Subjects", "book"), tab("hours", "/time-slots", "Class Hours", "clock")),
    h(
      "ol",
      { class: "grid gap-2 rounded-xl border bg-surface p-3 text-sm sm:grid-cols-3", "aria-label": "What to do here" },
      h("li", { class: active === "subjects" ? "font-medium text-brand" : "" }, "1. List the subjects: just their names."),
      h("li", { class: active === "hours" ? "font-medium text-brand" : "" }, "2. Class Hours: the periods and breaks. Optional: times can also be typed while plotting."),
      h("li", null, "3. Next: Sections, then give each subject its teacher in Teacher Loading."),
    ),
  );
}
