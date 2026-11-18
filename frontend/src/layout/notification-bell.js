// @ts-check
/**
 * Alerts under the bell: what needs the user (schedules to review, accounts to activate...).
 * Checked every minute. The count shows what is new since the list was last opened.
 */
import { h, replace } from "@/lib/dom.js";
import { api } from "@/api/client.js";
import { icon } from "@/components/icons.js";
import { readSetting, saveSetting } from "@/lib/storage.js";
import { session } from "@/state/session.js";

/** @typedef {{ key: string, title: string, body: string, link: string, at: string }} AppNotification */

/**
 * New since the user last opened the list. Never opened means all of them are new.
 * @param {AppNotification[]} items
 * @param {string | null} seenAt
 */
export function unreadCount(items, seenAt) {
  if (!seenAt) return items.length;
  const seen = new Date(seenAt).getTime();
  return items.filter(({ at }) => new Date(at).getTime() > seen).length;
}

export function notificationBell() {
  const seenKey = `notifications-seen-${session.user?.id ?? "none"}`;
  /** @type {AppNotification[]} */
  let items = [];

  // The count sits inside the button, beside the word, so nothing sticks out of it.
  const count = h("span", { class: "min-w-6 rounded-full bg-brand px-1.5 text-center text-sm font-bold leading-6 text-white", hidden: true });
  const button = h(
    "button",
    { type: "button", class: "btn btn-quiet px-3", "aria-expanded": "false", onclick: () => (panel.hidden ? open() : close()) },
    icon("bell", "size-5"),
    h("span", { class: "text-sm" }, "Alerts"),
    count,
  );
  const list = h("div", { class: "max-h-[60dvh] overflow-y-auto" });
  const panel = h(
    "div",
    { class: "absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border bg-surface p-2 shadow-xl", hidden: true },
    h("p", { class: "px-2 pb-2 font-semibold" }, "Alerts"),
    list,
  );
  const wrapper = h("div", { class: "relative" }, button, panel);

  const draw = () => {
    const unread = unreadCount(items, readSetting(seenKey));
    count.hidden = unread === 0;
    count.textContent = unread > 9 ? "9+" : String(unread);
    button.setAttribute("aria-label", unread ? `Alerts, ${unread} new` : "Alerts");

    replace(
      list,
      items.length === 0
        ? h("p", { class: "px-2 py-4 text-sm text-muted-foreground" }, "Nothing needs you right now.")
        : items.map((item) =>
            h(
              "a",
              { href: item.link, class: "block min-h-11 rounded-lg px-2 py-2 hover:bg-surface-muted", onclick: close },
              h("span", { class: "block text-sm font-medium" }, item.title),
              h("span", { class: "block text-small text-muted-foreground" }, item.body),
            ),
          ),
    );
  };

  const onOutside = (/** @type {PointerEvent} */ event) => {
    if (!wrapper.contains(/** @type {Node} */ (event.target))) close();
  };
  const onKey = (/** @type {KeyboardEvent} */ event) => event.key === "Escape" && close();

  function open() {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    saveSetting(seenKey, new Date().toISOString());
    draw();
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKey);
  }

  function close() {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onOutside);
    document.removeEventListener("keydown", onKey);
  }

  const refresh = async () => {
    try {
      items = /** @type {{ data: AppNotification[] }} */ (await api("/notifications")).data;
      draw();
    } catch {
      // Alerts are a help, not a must: try again at the next minute.
    }
  };

  refresh();
  const timer = setInterval(() => (wrapper.isConnected ? refresh() : clearInterval(timer)), 60_000);
  return wrapper;
}
