// @ts-check
/**
 * The top of every page, the same way everywhere (design audit, Must fix #11): an icon, the
 * title, a short description, and at most one main button with any quieter ones beside it.
 */
import { h } from "@/lib/dom.js";
import { icon } from "./icons.js";

/**
 * @param {{ icon: import("./icons.js").IconName, title: string, description: string, actions?: import("@/lib/dom.js").Child, crumbs?: { label: string, to?: string }[] }} props
 */
export function pageHeader({ icon: iconName, title, description, actions, crumbs }) {
  return h(
    "div",
    { class: "space-y-3" },
    crumbs ? breadcrumbs(crumbs) : null,
    h(
      "div",
      { class: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" },
      h(
        "div",
        { class: "flex min-w-0 items-start gap-3" },
        h("span", { class: "flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white" }, icon(iconName, "size-5")),
        h("div", { class: "min-w-0" }, h("h1", { class: "text-xl font-semibold text-brand" }, title), h("p", { class: "text-sm text-muted-foreground" }, description)),
      ),
      actions ? h("div", { class: "flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end" }, actions) : null,
    ),
  );
}

/**
 * "Home · Schedule · Grade 7 – Honesty", each part a link except the last.
 * @param {{ label: string, to?: string }[]} items
 */
export function breadcrumbs(items) {
  return h(
    "nav",
    { "aria-label": "Breadcrumb", class: "flex flex-wrap items-center gap-1 text-sm text-muted-foreground" },
    items.map((item, index) => [
      index > 0 ? h("span", { "aria-hidden": "true" }, "·") : null,
      item.to ? h("a", { href: item.to, class: "inline-flex min-h-11 min-w-11 items-center justify-center px-1 hover:text-brand" }, item.label) : h("span", { class: "px-1 text-brand", "aria-current": "page" }, item.label),
    ]),
  );
}

/**
 * A helpful empty state: what is missing and a button to the next step.
 * @param {{ title: string, text: string, action?: import("@/lib/dom.js").Child }} props
 */
export function emptyState({ title, text, action }) {
  return h("div", { class: "space-y-3 rounded-xl border border-dashed p-6 text-sm" }, h("p", { class: "font-medium" }, title), h("p", { class: "text-muted-foreground" }, text), action ?? null);
}
