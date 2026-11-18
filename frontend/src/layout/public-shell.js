// @ts-check
/**
 * The frame of the public pages (home and Guest view): the system's name, light / dark mode,
 * View as Guest and Sign in on top; the school's name in a red band at the bottom.
 */
import { h } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { session } from "@/state/session.js";
import { themeButton } from "./theme-button.js";

/**
 * @param {HTMLElement} content
 * @param {{ school?: import("@/api/guest.js").PublicSchool | null }} [options]
 */
export function publicShell(content, { school = null } = {}) {
  const onGuestPage = location.pathname.startsWith("/guest");
  return h(
    "div",
    { class: "flex min-h-dvh flex-col bg-background" },
    h(
      "header",
      { class: "no-print sticky top-0 z-40 border-b bg-surface/95 backdrop-blur" },
      h(
        "div",
        { class: "mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-3 sm:px-5" },
        h("a", { href: "/", class: "flex min-h-11 min-w-0 items-center gap-2", "aria-label": "ERCIHS Scheduling System, home" }, h("img", { src: "/hero-logo.png", alt: "", class: "size-10 shrink-0" }), h("span", { class: "min-w-0 leading-tight" }, h("span", { class: "block font-semibold text-brand" }, "ERCIHS"), h("span", { class: "block text-small text-muted-foreground" }, "Scheduling System"))),
        h(
          "div",
          { class: "ml-auto flex items-center gap-1 sm:gap-2" },
          themeButton(),
          onGuestPage
            ? h("a", { href: "/", class: "btn btn-quiet hidden sm:inline-flex" }, icon("arrow-left"), "Back to home")
            : h("a", { href: "/guest", class: "btn btn-outline hidden sm:inline-flex" }, icon("calendar-search"), "View as Guest"),
          session.user ? h("a", { href: "/dashboard", class: "btn btn-primary" }, icon("dashboard"), "Dashboard") : h("a", { href: "/login", class: onGuestPage ? "btn btn-outline" : "btn btn-primary" }, icon("login"), "Sign in"),
        ),
      ),
    ),
    h("main", { class: "flex-1" }, content),
    h(
      "footer",
      { class: "no-print bg-brand text-white" },
      h(
        "div",
        { class: "mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5" },
        h("p", { class: "flex items-center gap-3 font-semibold" }, h("img", { src: "/hero-logo.png", alt: "", class: "size-9 shrink-0 rounded-full bg-white p-0.5" }), school?.school_name ?? "Emmanuel Resurreccion Congressional Integrated High School"),
        h("p", { class: "text-white/85" }, `© ${new Date().getFullYear()} ERCIHS Scheduling System`),
      ),
    ),
  );
}
