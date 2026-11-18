// @ts-check
/**
 * Download buttons for a generated file: PDF (the official form) and CSV (the data). Every export
 * is PDF or CSV (team decision, Nov 18, 2026). Each download says how it went.
 */
import { h } from "@/lib/dom.js";
import { downloadFile } from "@/api/client.js";
import { setBusy } from "./dialog.js";
import { icon } from "./icons.js";
import { toast } from "./toast.js";

/**
 * @param {{ basePath: string, label: string, formats?: ("pdf" | "csv")[] }} props
 *   basePath is the file's address without its extension, like "/terms/3/reports/teacher-load".
 */
export function downloadButtons({ basePath, label, formats = ["pdf", "csv"] }) {
  return h(
    "div",
    { class: formats.length > 1 ? "grid grid-cols-2 gap-2 sm:flex" : "grid sm:flex" },
    formats.map((extension) => {
      const button = /** @type {HTMLButtonElement} */ (
        h(
          "button",
          {
            type: "button",
            class: "btn btn-outline",
            "aria-label": `Download ${label} as ${extension.toUpperCase()}`,
            onclick: async () => {
              setBusy(button, true, "Preparing...");
              try {
                const [path, query] = basePath.split("?");
                const name = await downloadFile(`${path}.${extension}${query ? `?${query}` : ""}`);
                toast.success(`${name} was downloaded.`);
              } catch (error) {
                toast.error(error);
              } finally {
                setBusy(button, false);
              }
            },
          },
          icon("download"),
          extension.toUpperCase(),
        )
      );
      return button;
    }),
  );
}
