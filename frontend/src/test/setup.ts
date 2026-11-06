import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Pages load on demand, and the first load in a test run takes a moment.
configure({ asyncUtilTimeout: 8000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom has no media queries. Tests run as a wide screen.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;
