// @ts-check
/**
 * Submit for approval. Flags that must be fixed stop it; every other flag is fixed first or
 * checked ("acknowledged") one by one, and a note can go to the Admin.
 */
import { h, uid } from "@/lib/dom.js";
import { openDialog, setBusy } from "@/components/dialog.js";
import { toast } from "@/components/toast.js";
import { submitSchedule } from "@/api/schedule.js";

/**
 * @param {{ plotter: import("@/lib/schedule.js").Plotter, termId: number }} props
 */
export function openSubmitDialog({ plotter, termId }) {
  const blocking = plotter.flags.filter(({ blocking: isBlocking }) => isBlocking);
  const toAcknowledge = plotter.flags.filter(({ blocking: isBlocking, acknowledged }) => !isBlocking && !acknowledged);
  /** @type {Set<string>} */
  const checked = new Set();
  const noteId = uid("note");
  const note = /** @type {HTMLTextAreaElement} */ (h("textarea", { id: noteId, rows: 2, class: "input py-2" }));

  const submit = /** @type {HTMLButtonElement} */ (
    h(
      "button",
      {
        type: "button",
        class: "btn btn-primary",
        onclick: async () => {
          setBusy(submit, true, "Submitting...");
          try {
            await submitSchedule(termId, plotter.section.id, { acknowledged_flags: [...checked], note: note.value.trim() || undefined });
            toast.success(`${plotter.section.label} was sent to the Admin for approval.`);
            close();
          } catch (error) {
            toast.error(error);
            setBusy(submit, false);
          }
        },
      },
      "Submit for approval",
    )
  );

  const refresh = () => {
    submit.disabled = blocking.length > 0 || toAcknowledge.some(({ key }) => !checked.has(key));
  };

  const { close } = openDialog({
    title: "Submit for approval",
    description: `${plotter.section.label}. The schedule is locked until the Admin reviews it.`,
    body: h(
      "div",
      { class: "space-y-4" },
      blocking.map(({ message }) => h("p", { role: "alert", class: "rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger" }, `${message} Fix this before submitting.`)),
      toAcknowledge.length > 0
        ? h(
            "div",
            { class: "space-y-2" },
            h("p", { class: "text-sm" }, "Fix these on the schedule, or check each one to submit anyway:"),
            h(
              "ul",
              { class: "space-y-2" },
              toAcknowledge.map(({ key, message, severity }) =>
                h(
                  "li",
                  null,
                  h(
                    "label",
                    { class: `flex min-h-11 items-center gap-3 rounded-lg p-2 text-sm ${severity === "red" ? "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100"}` },
                    h("input", { type: "checkbox", class: "size-5 shrink-0 accent-[var(--brand)]", onchange: (/** @type {Event} */ event) => { const box = /** @type {HTMLInputElement} */ (event.target); box.checked ? checked.add(key) : checked.delete(key); refresh(); } }),
                    message,
                  ),
                ),
              ),
            ),
            h("div", { class: "space-y-1" }, h("label", { class: "field-label", htmlFor: noteId }, "Note for the Admin (optional)"), note),
          )
        : blocking.length === 0
          ? h("p", { class: "text-sm" }, "No flags left to check. This schedule is ready to submit.")
          : null,
    ),
    footer: [h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"), submit],
  });

  refresh();
}
