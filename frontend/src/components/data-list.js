// @ts-check
/**
 * A list of records: a table on wide screens and cards on phones (design rule), with actions
 * that always have words, like "Edit" (design audit, Must fix #5).
 */
import { h } from "@/lib/dom.js";
import { icon } from "./icons.js";

/**
 * @template T
 * @typedef {{ label: string, cell: (item: T) => import("@/lib/dom.js").Child, primary?: boolean }} Column
 */

/**
 * @template T
 * @param {{ items: T[], columns: Column<T>[], actions?: (item: T) => import("@/lib/dom.js").Child, label: string }} props
 */
export function dataList({ items, columns, actions, label }) {
  const primary = columns.find((column) => column.primary) ?? columns[0];
  return h(
    "div",
    null,
    h(
      "div",
      { class: "hidden overflow-x-auto rounded-xl border md:block" },
      h(
        "table",
        { class: "w-full text-sm", "aria-label": label },
        h("thead", { class: "bg-surface-muted text-left text-small text-muted-foreground" }, h("tr", null, columns.map((column) => h("th", { scope: "col", class: "p-3 font-medium" }, column.label)), actions ? h("th", { scope: "col", class: "p-3 font-medium" }, "Actions") : null)),
        h("tbody", null, items.map((item) => h("tr", { class: "border-t align-top" }, columns.map((column) => h("td", { class: `p-3 ${column === primary ? "font-medium" : ""}` }, column.cell(item))), actions ? h("td", { class: "p-3" }, h("div", { class: "flex flex-wrap gap-2" }, actions(item))) : null))),
      ),
    ),
    h(
      "ul",
      { class: "grid gap-3 md:hidden", "aria-label": label },
      items.map((item) =>
        h(
          "li",
          { class: "card space-y-2 p-4" },
          h("div", { class: "font-semibold text-accent" }, primary.cell(item)),
          h("dl", { class: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm" }, columns.filter((column) => column !== primary).flatMap((column) => [h("dt", { class: "text-muted-foreground" }, column.label), h("dd", null, column.cell(item))])),
          actions ? h("div", { class: "flex flex-wrap gap-2 pt-1" }, actions(item)) : null,
        ),
      ),
    ),
  );
}

/**
 * An "Edit" button with its word.
 * @param {string} name  what is edited, for screen readers
 * @param {() => void} onClick
 */
export function editButton(name, onClick) {
  return h("button", { type: "button", class: "btn btn-outline", "aria-label": `Edit ${name}`, onclick: onClick }, icon("pencil"), "Edit");
}
