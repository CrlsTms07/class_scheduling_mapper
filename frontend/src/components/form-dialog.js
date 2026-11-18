// @ts-check
/**
 * One way to add or edit any record: a centered dialog (UI requirement 2) built from a list of
 * fields. Dropdowns are searchable (UI requirement 3), times are 12-hour (UI requirement 5),
 * every field shows its own error, and the API's errors appear beside the field they are about.
 * Delete asks first and says what will be lost; a record that cannot be deleted says why.
 */
import { h, uid } from "@/lib/dom.js";
import { ApiError } from "@/api/client.js";
import { confirmAction, openDialog, setBusy } from "./dialog.js";
import { icon } from "./icons.js";
import { searchableSelect } from "./searchable-select.js";
import { timePicker } from "./time-picker.js";
import { toast } from "./toast.js";

/**
 * @typedef {object} FieldSpec
 * @property {string} name
 * @property {string} label
 * @property {"text" | "email" | "number" | "date" | "textarea" | "select" | "checkbox" | "time" | "multi"} [type]
 * @property {any} [value]
 * @property {boolean} [required]
 * @property {string} [help]
 * @property {{ value: string | number, label: string, hint?: string }[]} [options]  for select and multi
 * @property {number} [min]
 * @property {number} [max]
 * @property {boolean} [wide]  takes the whole row on wide screens
 * @property {boolean} [disabled]
 * @property {(value: any, values: Record<string, any>) => string | null} [check]  an extra rule
 * @property {(typed: string) => Promise<{ value: string | number, label: string }>} [onCreate]  select: adds what was typed
 *
 * @typedef {object} FormOptions
 * @property {string} title
 * @property {string} [description]
 * @property {FieldSpec[]} fields
 * @property {string} submitLabel
 * @property {(values: Record<string, any>) => Promise<string | void>} onSubmit  returns the success message
 * @property {{ label: string, message: string, run: () => Promise<string | void>, blockedReason?: string | null }} [remove]
 * @property {import("@/lib/dom.js").Child} [extra]  more content under the fields
 */

/**
 * Builds one field. Returns its element, how to read it, and how to show an error on it.
 * @param {FieldSpec} spec
 */
export function buildField(spec) {
  const id = uid(spec.name);
  const error = h("p", { id: `${id}-error`, class: "field-error", hidden: true, role: "alert" });
  const label = (/** @type {string} */ forId) => h("label", { class: "field-label", htmlFor: forId }, spec.label, spec.required || spec.type === "checkbox" ? null : h("span", { class: "font-normal text-muted-foreground" }, " (optional)"));
  const help = spec.help ? h("p", { class: "field-help" }, spec.help) : null;
  /** @type {() => any} */
  let read;
  /** @type {HTMLElement} */
  let element;

  if (spec.type === "select") {
    let choices = spec.options ?? [];
    const select = searchableSelect({
      label: spec.label + (spec.required ? "" : " (optional)"),
      options: choices,
      value: spec.value ?? "",
      help: spec.help,
      disabled: spec.disabled,
      create: spec.onCreate
        ? {
            label: (typed) => `Add "${typed}"`,
            run: async (typed) => {
              try {
                const option = await /** @type {NonNullable<FieldSpec["onCreate"]>} */ (spec.onCreate)(typed);
                choices = [...choices, option];
                select.setOptions(choices);
                select.setValue(option.value);
                toast.success(`${option.label} was added.`);
              } catch (error) {
                toast.error(error);
              }
            },
          }
        : undefined,
    });
    read = () => select.getValue();
    element = h("div", null, select, error);
  } else if (spec.type === "multi") {
    // Several choices, as toggle buttons (grade levels, days).
    const chosen = new Set((spec.value ?? []).map(String));
    const group = h("div", { role: "group", "aria-label": spec.label, class: "flex flex-wrap gap-2" }, (spec.options ?? []).map((option) => {
      const button = h("button", { type: "button", "aria-pressed": String(chosen.has(String(option.value))), class: `btn border ${chosen.has(String(option.value)) ? "border-brand bg-brand text-white" : "bg-surface"}`, disabled: spec.disabled, onclick: () => {
        const key = String(option.value);
        if (chosen.has(key)) chosen.delete(key);
        else chosen.add(key);
        button.setAttribute("aria-pressed", String(chosen.has(key)));
        button.className = `btn border ${chosen.has(key) ? "border-brand bg-brand text-white" : "bg-surface"}`;
      } }, option.label);
      return button;
    }));
    read = () => (spec.options ?? []).filter((option) => chosen.has(String(option.value))).map((option) => option.value);
    element = h("fieldset", { class: "space-y-2" }, h("legend", { class: "field-label" }, spec.label), group, help, error);
  } else if (spec.type === "checkbox") {
    const box = /** @type {HTMLInputElement} */ (h("input", { id, type: "checkbox", checked: !!spec.value, disabled: spec.disabled, class: "mt-0.5 size-5 shrink-0 accent-[var(--brand)]" }));
    read = () => box.checked;
    element = h("div", { class: "space-y-1" }, h("div", { class: "flex min-h-11 items-start gap-3" }, box, h("label", { htmlFor: id, class: "text-sm" }, spec.label)), help, error);
  } else if (spec.type === "time") {
    const picker = timePicker({ label: spec.label, value: spec.value ?? null });
    read = () => picker.getValue();
    element = h("div", null, picker, help, error);
  } else if (spec.type === "textarea") {
    const area = /** @type {HTMLTextAreaElement} */ (h("textarea", { id, rows: 3, class: "input py-2", disabled: spec.disabled, "aria-describedby": `${id}-error` }));
    area.value = spec.value ?? "";
    read = () => area.value.trim();
    element = h("div", { class: "space-y-1" }, label(id), area, help, error);
  } else {
    const input = /** @type {HTMLInputElement} */ (h("input", { id, type: spec.type ?? "text", class: "input", min: spec.min, max: spec.max, disabled: spec.disabled, inputMode: spec.type === "number" ? "numeric" : undefined, "aria-describedby": `${id}-error` }));
    input.value = spec.value === null || spec.value === undefined ? "" : String(spec.value);
    read = () => (spec.type === "number" ? (input.value.trim() === "" ? null : Number(input.value)) : input.value.trim());
    element = h("div", { class: "space-y-1" }, label(id), input, help, error);
  }

  if (spec.wide) element.classList.add("sm:col-span-2");

  return {
    element,
    read,
    /** @param {string | null} message */
    setError: (message) => {
      error.textContent = message ?? "";
      error.hidden = !message;
    },
  };
}

/**
 * Opens the form. Resolves when it closes.
 * @param {FormOptions} options
 */
export function openFormDialog({ title, description, fields, submitLabel, onSubmit, remove, extra }) {
  const built = fields.map((spec) => ({ spec, ...buildField(spec) }));
  const formError = h("p", { class: "rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger", role: "alert", hidden: true });
  const submit = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", onclick: () => save() }, submitLabel));

  const save = async () => {
    formError.hidden = true;
    /** @type {Record<string, any>} */
    const values = {};
    let firstBad = null;
    for (const item of built) {
      const value = item.read();
      values[item.spec.name] = value;
      const isEmpty = value === null || value === "" || (Array.isArray(value) && value.length === 0);
      const problem = item.spec.required && item.spec.type !== "checkbox" && isEmpty ? `${item.spec.label} is required` : null;
      item.setError(problem);
      if (problem && !firstBad) firstBad = item;
    }
    for (const item of built) {
      const problem = item.spec.check?.(values[item.spec.name], values) ?? null;
      if (problem) {
        item.setError(problem);
        if (!firstBad) firstBad = item;
      }
    }
    if (firstBad) {
      firstBad.element.querySelector("input, button, textarea")?.focus();
      return;
    }
    setBusy(submit, true);
    try {
      const message = await onSubmit(values);
      toast.success(message || "Saved.");
      close();
    } catch (error) {
      setBusy(submit, false);
      let placed = false;
      if (error instanceof ApiError && error.status === 422) {
        for (const [name, messages] of Object.entries(error.errors ?? {})) {
          const item = built.find(({ spec }) => spec.name === name || name.startsWith(`${spec.name}.`));
          if (item) {
            item.setError(messages[0]);
            placed = true;
          }
        }
      }
      if (!placed) {
        formError.textContent = error instanceof Error ? error.message : "Something went wrong. Please try again.";
        formError.hidden = false;
      }
      toast.error(error);
    }
  };

  const deleteButton = remove
    ? h("button", {
        type: "button",
        class: "btn btn-outline text-danger sm:mr-auto",
        disabled: !!remove.blockedReason,
        title: remove.blockedReason ?? undefined,
        onclick: async () => {
          const isSure = await confirmAction({ title: `${remove.label}?`, message: remove.message, confirmLabel: `Yes, ${remove.label.toLowerCase()}` });
          if (!isSure) return;
          try {
            toast.success((await remove.run()) || "Deleted.");
            close();
          } catch (error) {
            toast.error(error);
          }
        },
      }, icon("trash"), remove.label)
    : null;

  const { close } = openDialog({
    title,
    description,
    size: fields.length > 5 ? "lg" : "md",
    body: h(
      "div",
      { class: "space-y-4" },
      formError,
      h("div", { class: `grid gap-4 ${fields.length > 5 ? "sm:grid-cols-2" : ""}` }, built.map(({ element }) => element)),
      extra ?? null,
      remove?.blockedReason ? h("p", { class: "field-help" }, `It cannot be deleted: ${remove.blockedReason}`) : null,
    ),
    footer: [deleteButton, h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"), submit],
  });
}
