// @ts-check
/**
 * Starts the app: finds out who is signed in, loads the terms, then shows the page of the
 * address. Moving between pages does not reload the browser; links still work as links.
 */
// @ts-ignore CSS is handled by the bundler and has no TypeScript declarations.
import "@/styles/main.css";
import { h, replace } from "@/lib/dom.js";
import { applyTheme } from "@/state/theme.js";
import { loadUser, onUserChange, session } from "@/state/session.js";
import { loadTerms, onTermChange } from "@/state/term.js";
import { matchRoute, redirectFor } from "@/router.js";
import { appShell, authShell } from "@/layout/app-shell.js";
import { skeletonPage } from "@/components/loading.js";

const root = /** @type {HTMLElement} */ (document.getElementById("app"));

/** @type {null | (() => void)} */
let cleanup = null;
/** @type {null | ReturnType<typeof appShell>} */
let shell = null;
let renderCount = 0;

/**
 * Goes to another page of the app.
 * @param {string} path
 * @param {{ replace?: boolean }} [options]
 */
export function navigate(path, { replace: isReplace = false } = {}) {
  if (isReplace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  render();
}

/** Shows the page of the current address, inside the right frame. */
async function render() {
  const thisRender = ++renderCount;
  const found = matchRoute(location.pathname);
  const redirect = redirectFor(found?.route ?? null);

  if (redirect && redirect !== location.pathname) {
    navigate(redirect, { replace: true });
    return;
  }
  if (!found) return;

  cleanup?.();
  cleanup = null;

  const { route, params } = found;
  document.title = `${route.title ?? "ERCIHS"} · ERCIHS Class Scheduling`;

  /** @type {HTMLElement} */
  let container;
  if (route.layout === "app") {
    if (!shell || !root.contains(shell.frame)) {
      shell = appShell(navigate);
      replace(root, shell.frame);
    }
    shell.update(location.pathname);
    container = shell.main;
  } else {
    shell = null;
    container = h("div");
    replace(root, route.layout === "public" ? container : authShell(container));
  }

  replace(container, skeletonPage());

  try {
    const page = await route.page();
    if (thisRender !== renderCount) return; // the user already went elsewhere
    const pageArea = h("div");
    replace(container, pageArea);
    const done = await page.render(pageArea, {
      params,
      query: new URLSearchParams(location.search),
      navigate,
    });
    if (thisRender !== renderCount) {
      if (typeof done === "function") done();
      return;
    }
    cleanup = typeof done === "function" ? done : null;
    container.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  } catch (error) {
    console.error(error);
    replace(
      container,
      h(
        "div",
        { class: "p-6" },
        h(
          "p",
          { role: "alert", class: "text-danger" },
          "This page could not open. Please reload the page and try again.",
        ),
      ),
    );
  }
}

// Links inside the app change the page without reloading. New tabs and downloads still work.
document.addEventListener("click", (event) => {
  const link = /** @type {HTMLElement} */ (event.target).closest?.("a");
  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const href = link.getAttribute("href");
  if (
    !href ||
    !href.startsWith("/") ||
    link.target ||
    link.hasAttribute("download") ||
    // Server pages (like "Continue with Google") need a real page visit. On the live site the API
    // is on the same address, so these links start with "/" too and must not be kept in the app.
    link.relList.contains("external") ||
    /^\/(api|sanctum|auth\/google)(\/|$)/.test(href)
  )
    return;
  event.preventDefault();
  if (href !== location.pathname + location.search) navigate(href);
});

window.addEventListener("popstate", () => render());

async function start() {
  applyTheme();
  replace(root, skeletonPage());

  try {
    await loadUser();
    if (session.user) await loadTerms();
  } catch {
    replace(
      root,
      h(
        "div",
        {
          class:
            "flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center",
        },
        h(
          "p",
          { class: "text-sm" },
          "Cannot reach the server. Please check the connection and try again.",
        ),
        h(
          "button",
          {
            type: "button",
            class: "btn btn-primary",
            onclick: () => location.reload(),
          },
          "Try again",
        ),
      ),
    );
    return;
  }

  // Signing in or out redraws the frame (menu, name); a new term redraws the page.
  onUserChange(() => {
    shell = null;
  });
  onTermChange(() => {
    shell = null;
    render();
  });

  render();
}

start();
