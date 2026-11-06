import React from "react";

/** True while the screen matches the CSS media query. Updates when a phone rotates. */
export function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
