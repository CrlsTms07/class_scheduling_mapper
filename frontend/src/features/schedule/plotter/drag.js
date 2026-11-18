// @ts-check
/**
 * Drag and drop with Pointer Events, for mouse, pen and touch. A mouse drag starts after the
 * pointer moves a little; on a touch screen the finger holds first, so swiping still scrolls.
 * A short tap stays a tap (tap-to-assign keeps working without dragging).
 *
 * Draggable elements carry data-drag; places to drop on carry data-drop.
 */

const MOUSE_DISTANCE = 6;
const TOUCH_HOLD_MS = 220;
const TOUCH_TOLERANCE = 8;

/**
 * Turns on dragging inside an area. Returns the function that turns it off.
 * @param {HTMLElement} area
 * @param {(drag: string, drop: string) => void} onDrop  called with the two data values
 */
export function enableDrag(area, onDrop) {
  /** @type {null | { source: HTMLElement, value: string, pointerId: number, x: number, y: number, isTouch: boolean, timer?: number, ghost?: HTMLElement, over?: HTMLElement | null }} */
  let drag = null;

  const start = (/** @type {PointerEvent} */ event) => {
    const source = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (event.target).closest("[data-drag]"));
    if (!source || event.button !== 0 || !area.contains(source)) return;
    drag = { source, value: source.dataset.drag ?? "", pointerId: event.pointerId, x: event.clientX, y: event.clientY, isTouch: event.pointerType === "touch" };
    if (drag.isTouch) {
      drag.timer = window.setTimeout(() => begin(event.clientX, event.clientY), TOUCH_HOLD_MS);
    }
  };

  const begin = (/** @type {number} */ x, /** @type {number} */ y) => {
    if (!drag || drag.ghost) return;
    const rect = drag.source.getBoundingClientRect();
    const ghost = /** @type {HTMLElement} */ (drag.source.cloneNode(true));
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("data-drop");
    Object.assign(ghost.style, { position: "fixed", left: "0", top: "0", width: `${Math.min(rect.width, 260)}px`, pointerEvents: "none", zIndex: "90", opacity: "0.9", transform: `translate(${x - 20}px, ${y - 20}px)` });
    ghost.classList.add("shadow-xl");
    document.body.append(ghost);
    drag.ghost = ghost;
    drag.source.classList.add("opacity-40");
    navigator.vibrate?.(20);
  };

  const move = (/** @type {PointerEvent} */ event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);

    if (!drag.ghost) {
      if (drag.isTouch) {
        if (distance > TOUCH_TOLERANCE) cancel(); // a swipe: let the page scroll
        return;
      }
      if (distance < MOUSE_DISTANCE) return;
      begin(event.clientX, event.clientY);
    }

    event.preventDefault();
    if (drag.ghost) drag.ghost.style.transform = `translate(${event.clientX - 20}px, ${event.clientY - 20}px)`;
    const below = /** @type {HTMLElement | null} */ (document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-drop]") ?? null);
    if (below !== drag.over) {
      drag.over?.classList.remove("ring-2", "ring-brand");
      below?.classList.add("ring-2", "ring-brand");
      drag.over = below;
    }
  };

  const end = (/** @type {PointerEvent} */ event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const wasDragging = !!drag.ghost;
    const target = drag.over;
    const value = drag.value;
    cancel();
    if (wasDragging) {
      // The click that follows a drag is not a tap.
      area.addEventListener("click", (click) => click.stopPropagation(), { capture: true, once: true });
      if (target?.dataset.drop) onDrop(value, target.dataset.drop);
    }
  };

  const cancel = () => {
    if (!drag) return;
    clearTimeout(drag.timer);
    drag.ghost?.remove();
    drag.source.classList.remove("opacity-40");
    drag.over?.classList.remove("ring-2", "ring-brand");
    drag = null;
  };

  // While holding on a touch screen, the page must not scroll under the finger.
  const blockScroll = (/** @type {TouchEvent} */ event) => {
    if (drag?.ghost) event.preventDefault();
  };

  area.addEventListener("pointerdown", start);
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", cancel);
  area.addEventListener("touchmove", blockScroll, { passive: false });
  area.addEventListener("contextmenu", (event) => drag && event.preventDefault());

  return () => {
    cancel();
    area.removeEventListener("pointerdown", start);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    window.removeEventListener("pointercancel", cancel);
    area.removeEventListener("touchmove", blockScroll);
  };
}
