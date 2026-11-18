// @ts-check
/**
 * The frame around every signed-in page: the header (school, the term being worked on, alerts,
 * the user), the menu (a sidebar on wide screens, a drawer on phones) and the page area.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { confirmAction } from "@/components/dialog.js";
import { toast } from "@/components/toast.js";
import { navigationFor, ROLE_BADGES, ROLE_LABELS } from "@/lib/navigation.js";
import { displayName, initialsOf, session, signOut } from "@/state/session.js";
import { selectTerm, termLabel, termState } from "@/state/term.js";
import { notificationBell } from "./notification-bell.js";
import { themeButton } from "./theme-button.js";

/**
 * Builds the frame. Returns it, the area where pages go, and update() for the active menu item.
 * @param {(path: string) => void} navigate
 */
export function appShell(navigate) {
  const user = session.user;
  const groups = navigationFor(user?.role ?? null, !!user?.personnel);

  const menuLinks = () =>
    groups.map((group) =>
      h(
        "div",
        null,
        h("p", { class: "px-3 pb-0.5 pt-1.5 text-small font-semibold uppercase tracking-wide text-muted-foreground" }, group.label),
        group.items.map((item) =>
          h(
            "a",
            {
              href: item.path,
              "data-nav": item.path,
              class: "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-surface-muted",
            },
            icon(item.icon, "size-5"),
            item.name,
          ),
        ),
      ),
    );

  const signOutButton = () =>
    h(
      "button",
      {
        type: "button",
        class: "btn btn-quiet w-full justify-start px-3",
        onclick: async () => {
          const isSure = await confirmAction({ title: "Sign out?", message: "You will need your password to come back.", confirmLabel: "Yes, sign out", danger: false });
          if (!isSure) return;
          try {
            await signOut();
            toast.success("Signed out.");
            navigate("/login");
          } catch (error) {
            toast.error(error);
          }
        },
      },
      icon("logout", "size-5"),
      "Sign out",
    );

  const sidebar = h(
    "nav",
    { "aria-label": "Main menu", class: "no-print hidden w-64 shrink-0 flex-col border-r bg-surface lg:flex" },
    h("div", { class: "sticky top-[calc(4.5rem+1px)] flex max-h-[calc(100dvh-4.5rem-1px)] flex-col overflow-y-auto px-3 pb-1" }, menuLinks(), h("div", { class: "mt-1 border-t" }, signOutButton())),
  );

  // Phones and tablets: the same menu in a drawer from the left.
  const drawer = /** @type {HTMLDialogElement} */ (
    h(
      "dialog",
      { "aria-label": "Menu", class: "m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r bg-surface p-0 text-foreground backdrop:bg-black/50" },
      h(
        "div",
        { class: "flex h-full flex-col overflow-y-auto p-3" },
        h("div", { class: "flex items-center justify-between pb-2" }, h("span", { class: "font-semibold text-brand" }, "Menu"), h("button", { type: "button", class: "btn btn-quiet px-3", onclick: () => drawer.close() }, icon("x"), "Close")),
        h("div", { class: "mb-2 border-b pb-3" }, userBadge({ inDrawer: true })),
        menuLinks(),
        h("div", { class: "mt-4 border-t pt-2" }, signOutButton()),
      ),
    )
  );
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer || /** @type {HTMLElement} */ (event.target).closest("a")) drawer.close();
  });

  const termPicker = termState.term
    ? searchableSelect({
        label: "Working on",
        options: termState.terms.map((term) => ({ value: term.id, label: termLabel(term) })),
        value: termState.term.id,
        onChange: (value) => {
          selectTerm(Number(value));
          toast.info(`Now showing ${termState.term?.name}, SY ${termState.term?.school_year.name}.`);
        },
      })
    : h("p", { class: "text-sm text-muted-foreground" }, "No school year yet");
  termPicker.classList.add("w-full", "sm:w-80", "[&_label]:sr-only");

  const header = h(
    "header",
    { class: "no-print sticky top-0 z-40 border-b bg-surface/95 backdrop-blur" },
    h(
      "div",
      { class: "flex min-h-[4.5rem] items-center gap-2 px-3 sm:gap-4 sm:px-5" },
      h("button", { type: "button", class: "btn btn-quiet px-3 lg:hidden", "aria-label": "Menu", onclick: () => drawer.showModal() }, icon("menu", "size-5"), h("span", { class: "hidden sm:inline" }, "Menu")),
      h(
        "a",
        { href: "/dashboard", class: "flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2", "aria-label": "ERCIHS Scheduling System, home" },
        h("img", { src: "/hero-logo.png", alt: "", class: "size-10" }),
        h("span", { class: "hidden font-semibold text-brand md:inline" }, "ERCIHS Scheduling System"),
      ),
      h("div", { class: "hidden min-w-0 flex-1 sm:block" }, termPicker),
      h("div", { class: "ml-auto flex items-center gap-1 sm:gap-2" }, themeButton(), notificationBell(), userBadge()),
    ),
    // On phones, the term goes on its own line under the header, so it is always visible.
    h("div", { class: "px-3 pb-2 sm:hidden" }, phoneTermPicker()),
  );

  /**
   * Who is signed in: a round picture with the initials ("CT"), the name and the role as a
   * colored badge. On tablets only the picture shows (its label still says the name and role); on
   * small phones, all of it is at the top of the menu drawer.
   */
  function userBadge({ inDrawer = false } = {}) {
    const role = user?.role ?? null;
    const fullRole = role ? ROLE_LABELS[role] : "";
    return h(
      "div",
      // Small phones have no room in the header: there it shows at the top of the menu drawer.
      { class: inDrawer ? "flex items-center gap-2" : "hidden items-center gap-2 pl-1 sm:flex", "aria-label": `Signed in as ${displayName()}${fullRole ? `, ${fullRole}` : ""}`, role: "group" },
      h("span", { class: "flex size-10 shrink-0 items-center justify-center rounded-full border bg-surface-muted text-sm font-semibold text-muted-foreground", "aria-hidden": "true" }, initialsOf(user)),
      h(
        "span",
        { class: `min-w-0 flex-col items-start leading-tight ${inDrawer ? "flex" : "hidden xl:flex"}`, "aria-hidden": "true" },
        h("span", { class: "max-w-40 truncate text-sm font-medium" }, displayName()),
        role ? h("span", { class: "mt-0.5 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white", title: fullRole }, ROLE_BADGES[role]) : null,
      ),
    );
  }

  /** The same picker for phones, full width under the header. */
  function phoneTermPicker() {
    if (!termState.term) return h("p", { class: "text-sm text-muted-foreground" }, "No school year yet");
    const picker = searchableSelect({
      label: "Working on",
      options: termState.terms.map((term) => ({ value: term.id, label: termLabel(term) })),
      value: termState.term.id,
      onChange: (value) => selectTerm(Number(value)),
    });
    picker.classList.add("[&_label]:sr-only");
    return picker;
  }

  const main = h("main", { id: "page", class: "min-w-0 flex-1 focus:outline-none", tabindex: "-1" });
  // A column that fills the screen, so the menu runs to the bottom even on a short page.
  const frame = h("div", { class: "flex min-h-dvh flex-col" }, header, h("div", { class: "flex flex-1" }, sidebar, main), drawer);

  /** Marks the menu item of the open page. */
  const update = (/** @type {string} */ pathname) => {
    for (const link of frame.querySelectorAll("[data-nav]")) {
      const path = /** @type {HTMLElement} */ (link).dataset.nav ?? "";
      const isHere = pathname === path || pathname.startsWith(`${path}/`);
      link.classList.toggle("bg-brand", isHere);
      link.classList.toggle("text-white", isHere);
      link.classList.toggle("hover:bg-surface-muted", !isHere);
      if (isHere) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  };

  return { frame, main, update };
}

/**
 * The frame of the sign-in pages (sign in, sign up, forgot and reset password, and the steps an
 * account owes first): the form on the left under the school's logo; on wide screens, the
 * system's name and a picture on the right. Phones get the form only.
 * @param {HTMLElement} content
 */
export function authShell(content) {
  const form = h("div", { class: "w-full max-w-md" });
  replace(form, content);
  return h(
    "div",
    { class: "grid min-h-dvh bg-surface lg:grid-cols-2" },
    h(
      "div",
      { class: "flex flex-col px-4 py-3 sm:px-8" },
      h("div", { class: "flex items-center justify-between" }, h("a", { href: "/", class: "btn btn-quiet px-2 text-brand" }, icon("arrow-left"), "Back to home"), themeButton()),
      h(
        "div",
        { class: "flex flex-1 flex-col items-center justify-center gap-6 py-6" },
        h("a", { href: "/", class: "flex min-h-11 items-center", "aria-label": "ERCIHS Scheduling System, home" }, h("img", { src: "/hero-logo.png", alt: "", class: "size-20" })),
        form,
      ),
    ),
    h(
      "aside",
      // Stays in view while a long form (Sign up) scrolls, so the picture is never cut off.
      { class: "relative hidden flex-col items-center justify-center gap-4 overflow-hidden bg-surface-muted p-10 text-center lg:sticky lg:top-0 lg:flex lg:h-dvh", "aria-label": "About the system" },
      h("h2", { class: "text-4xl font-bold text-brand" }, "ERCIHS Scheduling System"),
      h("p", { class: "max-w-lg text-lg text-muted-foreground" }, "Plan classes, assign teachers and rooms, and keep everyone on the same timetable."),
      // The same box in both modes (only its background changes), so the picture never changes size.
      h("img", { src: "/login-illustration.svg", alt: "", class: "mt-6 max-h-[55dvh] w-full max-w-md rounded-3xl object-contain p-6 dark:bg-white/90" }),
    ),
  );
}
