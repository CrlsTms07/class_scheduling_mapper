// @ts-check
/**
 * The one dropdown of the system (UI requirement 3): type to filter, use the arrow keys and
 * Enter, or tap. Shows "No results" when nothing matches, and can offer "+ Add new ..." for
 * what is typed (used by the teacher dropdown to quick-add a teacher). With manage, each choice
 * can also be renamed or deleted right in the list (departments, designations, subject names).
 */
import { h, uid } from "@/lib/dom.js";
import { icon } from "./icons.js";
import { errorMessage as errorText } from "@/api/client.js";

/**
 * @typedef {{ value: string | number, label: string, hint?: string, disabled?: boolean }} Option
 *
 * @typedef {object} SelectOptions
 * @property {string} label  the field's label, shown above it
 * @property {Option[]} options
 * @property {string | number | null} [value]
 * @property {string} [placeholder]
 * @property {string} [help]
 * @property {boolean} [disabled]
 * @property {(value: string | number | null, option: Option | null) => void} [onChange]
 * @property {{ label: (typed: string) => string, run: (typed: string) => void | Promise<void> }} [create]
 * @property {{ rename: (option: Option, name: string) => Promise<void>, remove: (option: Option) => Promise<void> }} [manage]
 *   edit and delete a choice right in the list (a pencil and a trash button on each one)
 */

/**
 * A labelled searchable select. The returned element has getValue() and setOptions().
 * @param {SelectOptions} props
 */
export function searchableSelect({ label, options, value = null, placeholder = "Choose...", help, disabled = false, onChange, create, manage }) {
  const fieldId = uid("select");
  const listId = `${fieldId}-list`;
  let items = options;
  let current = value;
  let active = 0;
  let isOpen = false;
  /** The choice being renamed or deleted in the list, and how. */
  /** @type {{ value: string | number, mode: "rename" | "remove", error?: string } | null} */
  let managing = null;

  const shown = h("span", { class: "min-w-0 flex-1 truncate text-left" });
  const trigger = /** @type {HTMLButtonElement} */ (
    h(
      "button",
      {
        type: "button",
        id: fieldId,
        class: "input flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60",
        "aria-haspopup": "listbox",
        "aria-expanded": "false",
        disabled,
        onclick: () => (isOpen ? closeList() : openList()),
      },
      shown,
      icon("chevron-down", "size-4 text-muted-foreground"),
    )
  );

  const search = /** @type {HTMLInputElement} */ (
    h("input", {
      type: "search",
      class: "input",
      placeholder: "Type to search",
      "aria-label": `Search ${label.toLowerCase()}`,
      "aria-controls": listId,
      autocomplete: "off",
      oninput: () => {
        active = 0;
        drawList();
      },
      onkeydown: (/** @type {KeyboardEvent} */ event) => {
        const enabled = visibleOptions().filter((option) => !option.disabled);
        if (event.key === "ArrowDown") {
          event.preventDefault();
          active = Math.min(active + 1, enabled.length - 1 + (createAvailable() ? 1 : 0));
          drawList();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          active = Math.max(active - 1, 0);
          drawList();
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (active < enabled.length) choose(enabled[active]);
          else if (createAvailable()) runCreate();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeList();
          trigger.focus();
        }
      },
    })
  );

  const list = h("ul", { id: listId, role: "listbox", "aria-label": `${label} options`, class: "max-h-64 overflow-y-auto py-1" });
  const panel = h(
    "div",
    { class: "absolute inset-x-0 top-full z-50 mt-1 rounded-xl border bg-surface p-2 shadow-xl", hidden: true },
    search,
    list,
  );

  const wrapper = h(
    "div",
    { class: "relative space-y-1" },
    h("label", { class: "field-label", htmlFor: fieldId }, label),
    trigger,
    panel,
    help ? h("p", { class: "field-help" }, help) : null,
  );

  const visibleOptions = () => {
    const typed = search.value.trim().toLowerCase();
    return typed ? items.filter((option) => `${option.label} ${option.hint ?? ""}`.toLowerCase().includes(typed)) : items;
  };

  const createAvailable = () =>
    !!create && search.value.trim().length > 1 && !items.some((option) => option.label.toLowerCase() === search.value.trim().toLowerCase());

  const drawShown = () => {
    const option = items.find((item) => String(item.value) === String(current));
    shown.textContent = option ? option.label : placeholder;
    shown.classList.toggle("text-muted-foreground", !option);
  };

  const drawList = () => {
    const matches = visibleOptions();
    const enabled = matches.filter((option) => !option.disabled);
    list.replaceChildren();

    for (const option of matches) {
      const index = enabled.indexOf(option);
      const isSelected = String(option.value) === String(current);
      if (manage && managing && String(managing.value) === String(option.value)) {
        list.append(manageRow(option, managing));
        continue;
      }
      const tools = manage
        ? h(
            "span",
            { class: "flex shrink-0 gap-1" },
            h("button", { type: "button", class: "btn btn-quiet size-11 p-0 md:size-9", "aria-label": `Rename ${option.label}`, title: "Rename", onclick: (/** @type {MouseEvent} */ event) => { event.stopPropagation(); managing = { value: option.value, mode: "rename" }; drawList(); } }, icon("pencil", "size-4")),
            h("button", { type: "button", class: "btn btn-quiet size-11 p-0 text-danger md:size-9", "aria-label": `Delete ${option.label}`, title: "Delete", onclick: (/** @type {MouseEvent} */ event) => { event.stopPropagation(); managing = { value: option.value, mode: "remove" }; drawList(); } }, icon("trash", "size-4")),
          )
        : null;
      list.append(
        h(
          "li",
          {
            role: "option",
            "aria-selected": String(isSelected),
            "aria-disabled": option.disabled ? "true" : null,
            class: `flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${index === active ? "bg-brand-soft" : ""} ${option.disabled ? "cursor-not-allowed opacity-50" : "hover:bg-surface-muted"}`,
            onclick: () => !option.disabled && choose(option),
          },
          h(
            "span",
            { class: "min-w-0 flex-1" },
            h("span", { class: "block" }, option.label),
            option.hint ? h("span", { class: "block text-small text-muted-foreground" }, option.hint) : null,
          ),
          isSelected ? icon("check", "size-4 text-brand") : null,
          tools,
        ),
      );
    }

    if (matches.length === 0) {
      list.append(h("li", { class: "px-3 py-3 text-sm text-muted-foreground" }, "No results"));
    }

    if (createAvailable() && create) {
      const isActive = active === enabled.length;
      list.append(
        h(
          "li",
          {
            role: "option",
            "aria-selected": "false",
            class: `flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-brand ${isActive ? "bg-brand-soft" : "hover:bg-surface-muted"}`,
            onclick: runCreate,
          },
          icon("plus"),
          create.label(search.value.trim()),
        ),
      );
    }
  };

  /**
   * A choice being renamed (a text box with Save and Cancel) or deleted (Yes / No), right in the
   * list. A problem from the server (a name already used, a name still in use) shows under it.
   * @param {Option} option
   * @param {{ value: string | number, mode: "rename" | "remove", error?: string }} state
   */
  const manageRow = (option, state) => {
    const done = () => { managing = null; drawList(); search.focus(); };
    const fail = (/** @type {unknown} */ error) => { state.error = errorText(error); drawList(); };
    const errorLine = state.error ? h("p", { class: "field-error w-full", role: "alert" }, state.error) : null;
    if (state.mode === "remove") {
      return h("li", { class: "flex flex-wrap items-center gap-2 rounded-lg bg-danger/5 px-3 py-2 text-sm" },
        h("span", { class: "min-w-0 flex-1" }, `Delete ${option.label}?`),
        h("button", { type: "button", class: "btn btn-outline text-danger", onclick: async (/** @type {MouseEvent} */ event) => {
          event.stopPropagation();
          try {
            await manage?.remove(option);
            if (String(current) === String(option.value)) { current = null; drawShown(); onChange?.(null, null); }
            done();
          } catch (error) { fail(error); }
        } }, "Yes, delete"),
        h("button", { type: "button", class: "btn btn-quiet", onclick: (/** @type {MouseEvent} */ event) => { event.stopPropagation(); done(); } }, "No"),
        errorLine,
      );
    }
    const box = /** @type {HTMLInputElement} */ (h("input", { class: "input min-w-0 flex-1", value: option.label, "aria-label": `New name for ${option.label}`, onkeydown: (/** @type {KeyboardEvent} */ event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); save(); } if (event.key === "Escape") done(); } }));
    const save = async () => {
      const name = box.value.trim();
      if (name.length < 2) { state.error = "Type the new name."; drawList(); return; }
      try {
        await manage?.rename(option, name);
        done();
      } catch (error) { fail(error); }
    };
    queueMicrotask(() => box.focus());
    return h("li", { class: "flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted px-2 py-2" },
      box,
      h("button", { type: "button", class: "btn btn-primary", onclick: (/** @type {MouseEvent} */ event) => { event.stopPropagation(); save(); } }, "Save"),
      h("button", { type: "button", class: "btn btn-quiet", onclick: (/** @type {MouseEvent} */ event) => { event.stopPropagation(); done(); } }, "Cancel"),
      errorLine,
    );
  };

  const onOutside = (/** @type {PointerEvent} */ event) => {
    if (!wrapper.contains(/** @type {Node} */ (event.target))) closeList();
  };

  const openList = () => {
    isOpen = true;
    managing = null;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    search.value = "";
    const enabled = items.filter((option) => !option.disabled);
    active = Math.max(0, enabled.findIndex((option) => String(option.value) === String(current)));
    drawList();
    search.focus();
    document.addEventListener("pointerdown", onOutside);
  };

  const closeList = () => {
    isOpen = false;
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutside);
  };

  /** @param {Option} option */
  const choose = (option) => {
    current = option.value;
    drawShown();
    closeList();
    trigger.focus();
    onChange?.(current, option);
  };

  const runCreate = async () => {
    if (!create) return;
    const typed = search.value.trim();
    closeList();
    await create.run(typed);
  };

  drawShown();

  return Object.assign(wrapper, {
    /** The chosen value, or null. */
    getValue: () => current,
    /** @param {string | number | null} next */
    setValue: (next) => {
      current = next;
      drawShown();
    },
    /** @param {Option[]} next */
    setOptions: (next) => {
      items = next;
      drawShown();
      if (isOpen) drawList();
    },
    /** @param {boolean} next */
    setDisabled: (next) => {
      trigger.disabled = next;
    },
    focus: () => trigger.focus(),
  });
}
