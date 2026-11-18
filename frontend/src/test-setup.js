// @ts-check
// Runs before every test: a clean page, a toast area and empty storage.
import { afterEach } from "vitest";

afterEach(() => {
  document.body.innerHTML = "<div id=\"app\"></div><div id=\"toasts\"></div>";
  try {
    localStorage.clear();
  } catch {
    // Storage may be missing in some test setups.
  }
});
