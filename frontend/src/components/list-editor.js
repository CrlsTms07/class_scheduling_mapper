// @ts-check
/**
 * A dialog for short lists of names that forms choose from (tracks, departments, designations,
 * tasks): add a name, or delete one after confirming. A typed name is checked while typing (it must
 * read like a name and not be in the list yet), and Done does not close while a typed name was
 * not added. The server checks again, and keeps a name that is still in use.
 */
import { h, replace, uid } from "@/lib/dom.js";
import { errorMessage } from "@/api/client.js";
import { readableNameError } from "@/lib/forms.js";
import { icon } from "./icons.js";
import { confirmAction, openDialog, setBusy } from "./dialog.js";
import { skeletonList } from "./loading.js";
import { toast } from "./toast.js";

/**
 * @typedef {{ id: number, name: string }} ListItem
 * @typedef {{
 *   label: string,
 *   noun: string,
 *   items: ListItem[],
 *   add?: (name: string) => Promise<unknown>,
 *   remove?: (item: ListItem) => Promise<unknown>,
 *   note?: string,
 * }} ListGroup
 */

/**
 * @param {{ title: string, description?: string, load: () => Promise<ListGroup[]> }} props
 *   load is called again after every change, so the lists always match the server.
 */
export function openListEditor({ title, description, load }) {
  const body = h("div", { class: "space-y-6" }, skeletonList(3));
  /** @type {{ input: HTMLInputElement, warn: (message: string) => void }[]} */
  let pending = [];
  const { close } = openDialog({
    title,
    description,
    body,
    footer: h("button", {
      type: "button",
      class: "btn btn-primary",
      onclick: () => {
        // A name typed but never added would be lost without a word: say so instead of closing.
        const forgotten = pending.find(({ input }) => input.value.trim());
        if (forgotten) {
          forgotten.warn(`"${forgotten.input.value.trim()}" was not added yet. Press Add, or clear the box, then press Done.`);
          forgotten.input.focus();
          return;
        }
        close();
      },
    }, "Done"),
  });

  const draw = async () => {
    try {
      pending = [];
      replace(body, (await load()).map(groupSection));
    } catch (error) {
      replace(body, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };

  /** @param {ListGroup} group */
  const groupSection = (group) => {
    const inputId = uid("list-name");
    const errorId = `${inputId}-error`;
    const error = h("p", { id: errorId, class: "field-error", role: "alert", hidden: true });
    const showError = (/** @type {string | null} */ message) => {
      error.textContent = message ?? "";
      error.hidden = !message;
      input.setAttribute("aria-invalid", String(!!message));
    };
    const problem = () => readableNameError(input.value, group.items.map(({ name }) => name));
    const input = /** @type {HTMLInputElement} */ (h("input", {
      id: inputId,
      class: "input",
      maxLength: 80,
      autocomplete: "off",
      "aria-describedby": errorId,
      // Said while typing, not only after Add (from the 2nd character, so the first key is not scolded).
      oninput: () => showError(input.value.trim().length >= 2 ? problem() : null),
    }));
    const addButton = /** @type {HTMLButtonElement} */ (h("button", { type: "submit", class: "btn btn-outline shrink-0" }, icon("plus"), "Add"));
    if (group.add) pending.push({ input, warn: showError });

    const addForm = group.add
      ? h(
          "form",
          {
            class: "space-y-1",
            onsubmit: async (/** @type {SubmitEvent} */ event) => {
              event.preventDefault();
              const name = input.value.trim();
              const wrong = name ? problem() : "Type a name first.";
              if (wrong) {
                showError(wrong);
                input.focus();
                return;
              }
              setBusy(addButton, true, "Adding...");
              try {
                await group.add?.(name);
                toast.success(`${name} was added.`);
                await draw();
              } catch (failure) {
                showError(errorMessage(failure));
                toast.error(failure);
                setBusy(addButton, false);
              }
            },
          },
          h("label", { class: "field-label", htmlFor: inputId }, `New ${group.noun}`),
          h("div", { class: "flex gap-2" }, input, addButton),
          error,
        )
      : null;

    const row = (/** @type {ListItem} */ item) =>
      h(
        "li",
        { class: "flex min-h-12 items-center justify-between gap-2 px-3 py-1" },
        h("span", { class: "min-w-0 break-words text-sm" }, item.name),
        group.remove
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn-quiet shrink-0 text-danger",
                "aria-label": `Delete ${item.name}`,
                onclick: async () => {
                  const isSure = await confirmAction({
                    title: `Delete ${item.name}?`,
                    message: `This removes ${item.name} from the list of ${group.label.toLowerCase()}. It works only if no record uses it.`,
                    confirmLabel: "Delete",
                  });
                  if (!isSure) return;
                  try {
                    await group.remove?.(item);
                    toast.success(`${item.name} was deleted.`);
                    await draw();
                  } catch (error) {
                    toast.error(error);
                  }
                },
              },
              icon("trash"),
              "Delete",
            )
          : null,
      );

    return h(
      "section",
      { class: "space-y-2", "aria-label": group.label },
      h("h3", { class: "font-semibold text-accent" }, group.label),
      group.items.length
        ? h("ul", { class: "divide-y rounded-lg border" }, group.items.map(row))
        : h("p", { class: "text-sm text-muted-foreground" }, `No ${group.label.toLowerCase()} yet.`),
      group.note ? h("p", { class: "field-help" }, group.note) : null,
      addForm,
    );
  };

  draw();
}
