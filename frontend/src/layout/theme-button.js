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
    replace(button, icon(isDark ? "sun" : "moon", "size-5"), h("span", { class: "text-sm" }, isDark ? "Light" : "Dark"));
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
