// @ts-check
/**
 * A centered dialog for every form (UI requirement 2). It fits the screen, so all fields show;
 * on phones it uses the full width. Built on the browser's <dialog>, which keeps the keyboard
 * inside it, closes with Escape, and returns focus when it closes.
 */
import { h, append } from "@/lib/dom.js";
import { icon } from "./icons.js";
import { releaseToasts } from "./toast.js";

/**
 * @typedef {object} DialogOptions
 * @property {string} title
 * @property {string} [description]
 * @property {import("@/lib/dom.js").Child} body
 * @property {import("@/lib/dom.js").Child} [footer]  the buttons, main action last
 * @property {"sm" | "md" | "lg"} [size]
 * @property {() => void} [onClose]
 */

/**
 * Opens a dialog. Returns its element and a close() function.
 * @param {DialogOptions} options
 */
export function openDialog({ title, description, body, footer, size = "md", onClose }) {
  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-3xl" };
  const titleId = `dialog-title-${Math.random().toString(36).slice(2, 8)}`;

  const dialog = /** @type {HTMLDialogElement} */ (
    h(
      "dialog",
      {
        "aria-labelledby": titleId,
        class: `m-auto w-[calc(100%-1rem)] ${widths[size]} max-h-[calc(100dvh-1rem)] rounded-2xl border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/50`,
      },
      h(
        "div",
        { class: "flex max-h-[calc(100dvh-1rem)] flex-col" },
        h(
          "header",
          { class: "flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5" },
          h(
            "div",
            { class: "min-w-0" },
            h("h2", { id: titleId, class: "text-lg font-semibold text-brand" }, title),
            description ? h("p", { class: "text-sm text-muted-foreground" }, description) : null,
          ),
          h(
            "button",
            { type: "button", class: "btn btn-quiet -mr-2 px-3", onclick: () => close() },
            icon("x"),
            h("span", { class: "sr-only sm:not-sr-only" }, "Close"),
          ),
        ),
        h("div", { class: "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5", "data-dialog-body": "" }),
        footer
          ? h("footer", { class: "flex flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-5", "data-dialog-footer": "" })
          : null,
      ),
    )
  );

  append(/** @type {HTMLElement} */ (dialog.querySelector("[data-dialog-body]")), [body]);
  if (footer) append(/** @type {HTMLElement} */ (dialog.querySelector("[data-dialog-footer]")), [footer]);

  let isClosed = false;
  const close = () => {
    if (isClosed) return;
    isClosed = true;
    if (dialog.open) dialog.close();
    releaseToasts(dialog);
    dialog.remove();
    onClose?.();
  };

  dialog.addEventListener("close", close);
  // A click on the dark area outside closes it, like most apps.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  document.body.append(dialog);
  dialog.showModal();

  return { element: dialog, close };
}

/**
 * Asks before something that cannot be undone, and says what will be lost.
 * Resolves true when the user confirms.
 *
 * @param {{ title: string, message: string, confirmLabel: string, danger?: boolean }} options
 * @returns {Promise<boolean>}
 */
export function confirmAction({ title, message, confirmLabel, danger = true }) {
  return new Promise((resolve) => {
    let answer = false;
    const { close } = openDialog({
      title,
      size: "sm",
      body: h("p", { class: "text-sm" }, message),
      footer: [
        h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"),
        h(
          "button",
          {
            type: "button",
            class: `btn ${danger ? "btn-danger" : "btn-primary"}`,
            onclick: () => {
              answer = true;
              close();
            },
          },
          confirmLabel,
        ),
      ],
      onClose: () => resolve(answer),
    });
  });
}

/**
 * Puts a button into its saving state (spinner and words) and back.
 * @param {HTMLButtonElement} button
 * @param {boolean} isBusy
 * @param {string} [busyLabel]
 */
export function setBusy(button, isBusy, busyLabel = "Saving...") {
  if (isBusy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.replaceChildren(h("span", { class: "spinner", "aria-hidden": "true" }), busyLabel);
  } else {
    button.disabled = false;
    if (button.dataset.label !== undefined) button.innerHTML = button.dataset.label;
  }
}
