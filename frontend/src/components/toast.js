// @ts-check
/**
 * Pop-up notifications (UI requirement 4): every create, update, delete, submit, approve,
 * reject, reopen, import, export and sign-in says how it went, at the top center of the screen.
 * Errors show the API's message.
 *
 * The area is a manual popover: shown again on every notification, it moves to the top layer,
 * so it stays above an open dialog (a conflict message while placing a class is never hidden).
 */
import { h } from "@/lib/dom.js";
import { errorMessage } from "@/api/client.js";
import { icon } from "./icons.js";

const DURATION_MS = { success: 4000, error: 8000, info: 5000 };

const LOOKS = {
  success: { title: "Success", symbol: "circle-check", box: "border-success/50 border-l-success", tint: "text-success" },
  error: { title: "Failed", symbol: "alert", box: "border-danger/50 border-l-danger", tint: "text-danger" },
  info: { title: "Notice", symbol: "info", box: "border-border border-l-accent", tint: "text-accent" },
};

/** @type {HTMLElement | null} */
let toastArea = null;

/**
 * The notification area, inside the open modal dialog when there is one (outside it, the page is
 * inert while a dialog is open, so Close could not be pressed), or else in the page.
 */
function areaForNow() {
  // The one in the page when there is one; else the last one used (it left with a closed dialog).
  toastArea = document.getElementById("toasts") ?? toastArea;
  if (!toastArea) return null;
  const dialogs = [...document.querySelectorAll("dialog[open]")].filter((dialog) => {
    try {
      return dialog.matches(":modal");
    } catch {
      return false;
    }
  });
  const host = dialogs.at(-1) ?? document.body;
  if (toastArea.parentElement !== host) {
    host.append(toastArea);
    // A dialog that only closes (the menu drawer) gives the notifications back to the page.
    if (host !== document.body) host.addEventListener("close", () => releaseToasts(host), { once: true });
  }
  return toastArea;
}

/**
 * Gives the notifications back to the page (or the dialog under it) before a dialog closes or
 * is removed, so a "was saved" message shown while the dialog closes stays on screen.
 * @param {Element} dialog
 */
export function releaseToasts(dialog) {
  if (!toastArea || !dialog.contains(toastArea)) return;
  document.body.append(toastArea);
  if (toastArea.children.length) {
    areaForNow();
    bringToFront(toastArea);
  }
}

/** Puts the area in the top layer, above any open dialog. */
function bringToFront(/** @type {HTMLElement} */ area) {
  if (typeof area.showPopover !== "function") return;
  try {
    if (area.matches(":popover-open")) area.hidePopover();
    area.showPopover();
  } catch {
    // An old browser without popovers: the area still shows, below dialogs.
  }
}

/**
 * @param {"success" | "error" | "info"} kind
 * @param {string} message
 */
function show(kind, message) {
  const area = areaForNow();
  if (!area) return;
  const look = LOOKS[kind];

  const close = () => {
    item.classList.add("opacity-0", "-translate-y-2");
    setTimeout(() => {
      item.remove();
      if (!area.children.length && typeof area.hidePopover === "function" && area.matches?.(":popover-open")) {
        try {
          area.hidePopover();
        } catch {
          // already hidden
        }
      }
    }, 200);
  };

  const item = h(
    "div",
    {
      role: kind === "error" ? "alert" : "status",
      class: `pointer-events-auto flex w-full max-w-md -translate-y-2 items-start gap-3 rounded-xl border border-l-4 bg-surface p-3 opacity-0 shadow-lg transition duration-200 motion-reduce:transition-none ${look.box}`,
    },
    icon(/** @type {any} */ (look.symbol), `mt-0.5 size-5 shrink-0 ${look.tint}`),
    h(
      "div",
      { class: "min-w-0 flex-1" },
      h("p", { class: `text-sm font-semibold ${look.tint}` }, look.title),
      h("p", { class: "text-sm text-foreground" }, message),
    ),
    h(
      "button",
      { type: "button", class: "btn btn-quiet -my-2 -mr-2 px-3", onclick: close },
      icon("x"),
      h("span", { class: "sr-only" }, "Close"),
    ),
  );

  // Newest on top, right under the edge of the screen.
  area.prepend(item);
  bringToFront(area);
  requestAnimationFrame(() => item.classList.remove("opacity-0", "-translate-y-2"));
  setTimeout(close, DURATION_MS[kind]);
}

export const toast = {
  /** @param {string} message */
  success: (message) => show("success", message),
  /** @param {string} message */
  info: (message) => show("info", message),
  /**
   * Shows an error: a text, or the API's message for an error object.
   * @param {unknown} error
   */
  error: (error) => show("error", typeof error === "string" ? error : errorMessage(error)),
};
