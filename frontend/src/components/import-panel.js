// @ts-check
/**
 * Import panel for master data (teachers, subjects, rooms, sections), used by the Setup Guide:
 * 1) download the template, 2) upload the filled-in .xlsx, 3) review every row (new, update, skip
 * or error, with the reason) and choose what to do with records already in the system, 4) import.
 * Nothing is saved until Import; the review and the import run the same checks on the server.
 */
import { h, replace } from "@/lib/dom.js";
import { openDialog, setBusy } from "@/components/dialog.js";
import { icon } from "@/components/icons.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { downloadImportTemplate, sendImport } from "@/api/imports.js";

/**
 * @typedef {import("@/api/imports.js").ImportType} ImportType
 * @typedef {import("@/api/imports.js").ImportResult} ImportResult
 * @typedef {import("@/api/imports.js").ImportRow} ImportRow
 */

/** @type {Record<ImportType, { plural: string, columns: string, first?: string }>} */
export const IMPORT_TYPES = {
  teachers: {
    plural: "teachers",
    columns: "employee_id, last_name, first_name, middle_name, email, department, personnel_type",
    first: "Each department must already be in the list (Teachers page, Edit lists).",
  },
  subjects: {
    plural: "subjects",
    columns: "subject_name, grade_level, minutes_per_week, track, term_no, subject_type",
    first: "Senior High tracks must already be in the list (Subjects page, Tracks).",
  },
  rooms: {
    plural: "rooms",
    columns: "building, room_number, room_name, department",
  },
  sections: {
    plural: "sections",
    columns: "section_name, grade_level, track, adviser_employee_id, co_adviser_employee_id, shift",
    first: "Import the teachers first: advisers are matched by employee ID.",
  },
};

/** @type {Record<ImportRow["status"], { label: string, chip: string }>} */
export const STATUS_CHIPS = {
  new: { label: "New", chip: "bg-success/10 text-success" },
  update: { label: "Update", chip: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100" },
  skip: { label: "Skip", chip: "bg-surface-muted text-muted-foreground" },
  error: { label: "Error", chip: "bg-danger/10 text-danger" },
};

/**
 * Whether anything in a review would be saved.
 * @param {ImportResult} result
 */
export function canImport(result) {
  return result.summary.new + result.summary.update > 0;
}

/**
 * "45 added, 3 updated, 2 skipped, 1 error" (or "would be ..." words for a review).
 * @param {ImportResult} result
 */
export function importSummaryText(result) {
  const { new: added, update: updated, skip: skipped, error: errors } = result.summary;
  if (result.mode === "preview") {
    return `${added} new, ${updated} to update, ${skipped} to skip, ${errors} with ${errors === 1 ? "an error" : "errors"}.`;
  }
  return `${added} added, ${updated} updated, ${skipped} skipped, ${errors} ${errors === 1 ? "error" : "errors"}.`;
}

/**
 * The rows with errors as a CSV the user can open in Excel and fix.
 * @param {ImportResult} result
 * @param {ImportType} type
 */
function downloadErrors(result, type) {
  const cell = (/** @type {string | number} */ value) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [
    ["Row", "Record", "What to fix"].map(cell).join(","),
    ...result.rows.filter((row) => row.status === "error").map((row) => [row.row_number, row.label, row.messages.join(" ")].map(cell).join(",")),
  ];
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `${type}-rows-to-fix.csv` });
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The rows of a review or an import, with a status chip and the reasons.
 * @param {ImportResult} result
 */
export function importRowsList(result) {
  let onlyProblems = result.summary.error > 0;
  const area = h("div", { class: "space-y-2" });
  const draw = () => {
    const rows = onlyProblems ? result.rows.filter((row) => row.status === "error") : result.rows;
    replace(
      area,
      result.summary.error > 0
        ? h("button", { type: "button", class: "btn btn-quiet px-0 text-brand", onclick: () => { onlyProblems = !onlyProblems; draw(); } }, onlyProblems ? `Show all ${result.summary.total} rows` : "Show only the rows with errors")
        : null,
      h(
        "ul",
        { class: "max-h-[45dvh] divide-y overflow-y-auto rounded-lg border text-sm", "aria-label": "Rows of the file" },
        rows.map((row) =>
          h(
            "li",
            { class: `flex items-start gap-3 p-3 ${row.status === "error" ? "bg-danger/5" : ""}` },
            h("span", { class: `badge shrink-0 ${STATUS_CHIPS[row.status].chip}` }, STATUS_CHIPS[row.status].label),
            h(
              "div",
              { class: "min-w-0" },
              h("p", { class: "font-medium" }, `Row ${row.row_number}: ${row.label}`),
              row.messages.map((message) => h("p", { class: `text-small ${row.status === "error" ? "text-danger" : "text-muted-foreground"}` }, message.replace(/^Row \d+: /, ""))),
            ),
          ),
        ),
      ),
    );
  };
  draw();
  return area;
}

/**
 * Opens the import panel for one kind of record.
 * @param {{ type: ImportType, schoolYear: { id: number, name: string }, onDone?: () => void }} props
 */
export function openImportPanel({ type, schoolYear, onDone }) {
  const info = IMPORT_TYPES[type];
  /** @type {File | null} */
  let file = null;
  /** @type {"skip" | "update"} */
  let onDuplicate = "skip";
  /** @type {ImportResult | null} */
  let review = null;
  let isDone = false;

  const errorArea = h("div", { role: "alert" });
  const reviewArea = h("div", { "aria-live": "polite" });
  const fileInput = /** @type {HTMLInputElement} */ (h("input", { type: "file", accept: ".xlsx,.pdf", class: "hidden", "aria-label": `${info.plural} file` }));
  const fileButton = h("button", { type: "button", class: "btn btn-outline w-full", onclick: () => fileInput.click() }, icon("file-up"), h("span", { class: "truncate" }, "Choose the filled-in Excel file (.xlsx)"));
  const main = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", disabled: true, onclick: () => (isDone ? close() : save()) }, "Import"));
  const cancel = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"));

  const showError = (/** @type {unknown} */ error) => {
    replace(errorArea, h("p", { class: "rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger" }, errorMessage(error)));
  };

  const drawReview = () => {
    if (!review) return;
    replace(
      reviewArea,
      h(
        "section",
        { class: "space-y-3" },
        h("p", { class: "field-label" }, "3. Review every row"),
        h("p", { class: "text-sm" }, importSummaryText(review)),
        importRowsList(review),
        review.summary.error > 0 ? h("p", { class: "text-small text-muted-foreground" }, "Rows with errors are left out. Fix them in the Excel file and upload it again, or add them on their page.") : null,
      ),
    );
    const count = review.summary.new + review.summary.update;
    main.textContent = count > 0 ? `Import ${count} ${count === 1 ? "row" : "rows"}` : "Nothing to import";
    main.disabled = !canImport(review);
  };

  const check = async () => {
    if (!file) return;
    review = null;
    errorArea.replaceChildren();
    reviewArea.replaceChildren(h("p", { class: "flex items-center gap-2 text-sm text-muted-foreground" }, h("span", { class: "spinner" }), "Checking every row..."));
    main.disabled = true;
    try {
      review = await sendImport(schoolYear.id, type, { file, mode: "preview", onDuplicate });
      drawReview();
    } catch (error) {
      reviewArea.replaceChildren();
      showError(error);
      main.textContent = "Import";
    }
  };

  const save = async () => {
    if (!file || !review) return;
    errorArea.replaceChildren();
    setBusy(main, true, "Importing...");
    try {
      const done = await sendImport(schoolYear.id, type, { file, mode: "commit", onDuplicate });
      setBusy(main, false);
      isDone = true;
      toast.success(`Imported ${info.plural}: ${importSummaryText(done)}`);
      replace(
        body,
        h(
          "div",
          { class: "space-y-3", role: "status" },
          h("div", { class: "space-y-1 rounded-xl border border-success/40 bg-success/5 p-3" }, h("p", { class: "font-medium" }, importSummaryText(done))),
          importRowsList(done),
          done.summary.error > 0 ? h("button", { type: "button", class: "btn btn-outline w-full", onclick: () => downloadErrors(done, type) }, icon("download"), "Download the rows to fix (CSV)") : null,
        ),
      );
      main.textContent = "Done";
      cancel.hidden = true;
      onDone?.();
    } catch (error) {
      setBusy(main, false);
      showError(error);
      toast.error(error);
    }
  };

  fileInput.addEventListener("change", () => {
    file = fileInput.files?.[0] ?? null;
    fileInput.value = "";
    replace(fileButton, icon("file-up"), h("span", { class: "truncate" }, file ? file.name : "Choose the filled-in Excel file (.xlsx)"));
    check();
  });

  const duplicateChoice = h(
    "fieldset",
    { class: "space-y-2" },
    h("legend", { class: "field-label" }, `If a record is already in the system`),
    ...[
      { value: "skip", label: "Skip it", hint: "Keep what is in the system." },
      { value: "update", label: "Update it", hint: "Use the values in the file." },
    ].map((choice) =>
      h(
        "label",
        { class: "flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm" },
        h("input", {
          type: "radio",
          name: `on-duplicate-${type}`,
          value: choice.value,
          checked: choice.value === onDuplicate,
          class: "mt-0.5 size-5 shrink-0 accent-[var(--brand)]",
          onchange: () => {
            onDuplicate = /** @type {"skip" | "update"} */ (choice.value);
            check();
          },
        }),
        h("span", null, h("span", { class: "block font-medium" }, choice.label), h("span", { class: "block text-small text-muted-foreground" }, choice.hint)),
      ),
    ),
  );

  const body = h(
    "div",
    { class: "space-y-5" },
    errorArea,
    h(
      "section",
      { class: "space-y-2" },
      h("p", { class: "field-label" }, "1. Download the template"),
      h("p", { class: "field-help" }, `Columns: ${info.columns}. Keep the headers on row 1.${info.first ? ` ${info.first}` : ""}`),
      h(
        "button",
        {
          type: "button",
          class: "btn btn-outline w-full",
          onclick: async () => {
            try {
              toast.success(`${await downloadImportTemplate(type)} was downloaded.`);
            } catch (error) {
              toast.error(error);
            }
          },
        },
        icon("download"),
        `Download the ${info.plural} template (.xlsx)`,
      ),
    ),
    h("section", { class: "space-y-2" }, h("p", { class: "field-label" }, "2. Upload the filled-in file"), fileInput, fileButton),
    duplicateChoice,
    reviewArea,
  );

  const { close } = openDialog({
    title: `Import ${info.plural}`,
    description: `Into SY ${schoolYear.name}. Nothing is saved until you press Import. You can still add and edit each record on its own page.`,
    size: "lg",
    body,
    footer: [cancel, main],
  });

  return { close };
}
