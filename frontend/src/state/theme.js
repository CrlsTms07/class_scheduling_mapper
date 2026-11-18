// @ts-check
/**
 * Light or dark mode. It follows the device unless the user picked one.
 */
import { readSetting, saveSetting } from "@/lib/storage.js";

const KEY = "theme";

/** Puts the saved (or device) choice on the page. */
export function applyTheme() {
  const saved = readSetting(KEY);
  const isDark = saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", !!isDark);
}

/**
 * Switches between light and dark, and remembers it.
 * @returns {"light" | "dark"} the new mode
 */
export function toggleTheme() {
  const isDark = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", isDark);
  saveSetting(KEY, isDark ? "dark" : "light");
  return isDark ? "dark" : "light";
}
