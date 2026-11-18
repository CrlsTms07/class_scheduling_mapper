// @ts-check
/**
 * The light / dark mode button. It says which mode it switches to, and is remembered.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { toggleTheme } from "@/state/theme.js";

export function themeButton() {
  const button = h("button", { type: "button", class: "btn btn-quiet px-3" });
  const draw = () => {
    const isDark = document.documentElement.classList.contains("dark");
    // Both words sit in the same spot and only one is shown, so the button keeps one width in both
    // modes and nothing next to it moves.
    replace(
      button,
      icon(isDark ? "sun" : "moon", "size-5"),
      h(
        "span",
        { class: "grid text-sm" },
        h("span", { class: `col-start-1 row-start-1 ${isDark ? "" : "invisible"}`, "aria-hidden": String(!isDark) }, "Light"),
        h("span", { class: `col-start-1 row-start-1 ${isDark ? "invisible" : ""}`, "aria-hidden": String(isDark) }, "Dark"),
      ),
    );
    button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    button.setAttribute("aria-pressed", String(isDark));
  };
  button.addEventListener("click", () => {
    toggleTheme();
    draw();
  });
  draw();
  return button;
}
