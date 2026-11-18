// @ts-check
/**
 * Loading states (UI requirement 1): gray placeholders shaped like what is coming, instead of
 * the word "Loading". The pulse stops for people who turned on "reduce motion".
 */
import { h } from "@/lib/dom.js";

/**
 * Placeholder rows for a list or table.
 * @param {number} [rows]
 */
export function skeletonList(rows = 5) {
  return h(
    "div",
    { class: "space-y-3", role: "status", "aria-label": "Loading" },
    Array.from({ length: rows }, () =>
      h("div", { class: "card flex items-center gap-3 p-4" }, h("div", { class: "skeleton size-10 rounded-lg" }), h("div", { class: "flex-1 space-y-2" }, h("div", { class: "skeleton h-4 w-1/2" }), h("div", { class: "skeleton h-3 w-1/3" }))),
    ),
  );
}

/**
 * A placeholder page: a title, a bar and cards.
 */
export function skeletonPage() {
  return h(
    "div",
    { class: "space-y-5 p-4 sm:p-6", role: "status", "aria-label": "Loading" },
    h("div", { class: "space-y-2" }, h("div", { class: "skeleton h-7 w-56" }), h("div", { class: "skeleton h-4 w-80 max-w-full" })),
    h("div", { class: "skeleton h-14 w-full" }),
    h("div", { class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" }, Array.from({ length: 6 }, () => h("div", { class: "skeleton h-28" }))),
  );
}
