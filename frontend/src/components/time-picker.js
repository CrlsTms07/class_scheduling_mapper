// @ts-check
/**
 * A 12-hour time field (UI requirement 5): the time is typed ("7:30") and AM or PM is a tap,
 * so every phone shows the same thing, never 24-hour time. Any time of the day can be used.
 */
import { h, uid } from "@/lib/dom.js";
import { parseTime, splitTime } from "@/lib/time.js";

/**
 * @param {{ label: string, value?: string | null, onChange?: (value: string | null) => void }} props
 *   value is "HH:MM" in 24 hours (what the API uses), or null when empty.
 */
export function timePicker({ label, value = null, onChange }) {
  const inputId = uid("time");
  const start = value ? splitTime(value) : { typed: "", period: /** @type {"AM" | "PM"} */ ("AM") };
  let period = start.period;

  const error = h("p", { class: "field-error", hidden: true, role: "alert" });
  const input = /** @type {HTMLInputElement} */ (
    h("input", {
      id: inputId,
      class: "input w-28 text-center tabular-nums",
      inputMode: "numeric",
      placeholder: "7:30",
      autocomplete: "off",
      value: start.typed,
      "aria-describedby": `${inputId}-period`,
      onblur: () => {
        check();
        onChange?.(getValue());
      },
    })
  );

  /** @param {"AM" | "PM"} next */
  const periodButton = (next) =>
    h(
      "button",
      {
        type: "button",
        class: "btn min-w-14 rounded-none border-0 px-3",
        "aria-pressed": String(period === next),
        onclick: () => {
          period = next;
          drawPeriod();
          onChange?.(getValue());
        },
      },
      next,
    );
  const am = periodButton("AM");
  const pm = periodButton("PM");

  const drawPeriod = () => {
    for (const [button, name] of [[am, "AM"], [pm, "PM"]]) {
      const isOn = period === name;
      /** @type {HTMLElement} */ (button).setAttribute("aria-pressed", String(isOn));
      /** @type {HTMLElement} */ (button).className = `btn min-w-14 rounded-none border-0 px-3 ${isOn ? "bg-brand text-white" : "bg-surface text-foreground hover:bg-surface-muted"}`;
    }
  };

  const check = () => {
    const typed = input.value.trim();
    const isBad = typed !== "" && parseTime(typed, period) === null;
    error.hidden = !isBad;
    error.textContent = isBad ? "Type a time like 7:30 (hour 1 to 12, minutes 0 to 59)." : "";
    input.setAttribute("aria-invalid", String(isBad));
    return !isBad;
  };

  /** "HH:MM" in 24 hours, or null when empty or not a time. */
  const getValue = () => (input.value.trim() ? parseTime(input.value, period) : null);

  drawPeriod();

  const wrapper = h(
    "div",
    { class: "space-y-1" },
    h("label", { class: "field-label", htmlFor: inputId }, label),
    h(
      "div",
      { class: "flex items-center gap-2" },
      input,
      h("div", { id: `${inputId}-period`, role: "group", "aria-label": `${label}: AM or PM`, class: "flex overflow-hidden rounded-lg border" }, am, pm),
    ),
    error,
  );

  return Object.assign(wrapper, {
    getValue,
    /** Shows the error and returns false when what is typed is not a time. */
    validate: check,
    /** @param {string | null} next */
    setValue: (next) => {
      const parts = next ? splitTime(next) : { typed: "", period: "AM" };
      input.value = parts.typed;
      period = /** @type {"AM" | "PM"} */ (parts.period);
      drawPeriod();
      check();
    },
  });
}
