// @ts-check
/**
 * A 12-hour time field (UI requirement 5) made of choices, never typing: an hour list (1 to 12), a
 * minutes list (every 5 minutes) and AM / PM buttons. Nothing can be typed in a wrong format, and
 * every change is reported at once so the form can check it (overlaps, end after start) before Save.
 */
import { h, uid } from "@/lib/dom.js";
import { searchableSelect } from "./searchable-select.js";

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const two = (/** @type {number} */ number) => String(number).padStart(2, "0");

/**
 * "HH:MM" in 24 hours into its 12-hour parts.
 * @param {string} value
 */
function partsOf(value) {
  const hours = Number(value.slice(0, 2));
  const minutes = Number(value.slice(3, 5));
  return { hour: hours % 12 === 0 ? 12 : hours % 12, minute: minutes, period: /** @type {"AM" | "PM"} */ (hours < 12 ? "AM" : "PM") };
}

/**
 * @param {{ label: string, value?: string | null, onChange?: (value: string | null) => void }} props
 *   value is "HH:MM" in 24 hours (what the API uses), or null when empty.
 */
export function timePicker({ label, value = null, onChange }) {
  const groupId = uid("time");
  const start = value ? partsOf(value) : null;
  /** @type {{ hour: number | null, minute: number | null, period: "AM" | "PM" }} */
  const state = { hour: start?.hour ?? null, minute: start?.minute ?? null, period: start?.period ?? "AM" };

  const error = h("p", { id: `${groupId}-error`, class: "field-error", hidden: true, role: "alert" });

  /** Every 5 minutes, plus an older time's own minute (like :07), so it is never lost. */
  const minuteOptions = () =>
    [...new Set([...MINUTES, ...(state.minute !== null ? [state.minute] : [])])].sort((a, b) => a - b).map((minute) => ({ value: minute, label: two(minute) }));

  const changed = () => {
    check();
    onChange?.(getValue());
  };

  const hourSelect = searchableSelect({
    label: "Hour",
    placeholder: "--",
    value: state.hour,
    options: HOURS.map((hour) => ({ value: hour, label: String(hour) })),
    onChange: (next) => {
      state.hour = next === null ? null : Number(next);
      changed();
    },
  });
  const minuteSelect = searchableSelect({
    label: "Minutes",
    placeholder: "--",
    value: state.minute,
    options: minuteOptions(),
    onChange: (next) => {
      state.minute = next === null ? null : Number(next);
      changed();
    },
  });
  // Narrow enough on a phone for hour, minutes and AM / PM to share one line.
  hourSelect.classList.add("w-[4.75rem]", "sm:w-24");
  minuteSelect.classList.add("w-[4.75rem]", "sm:w-24");

  /** @param {"AM" | "PM"} next */
  const periodButton = (next) =>
    h("button", {
      type: "button",
      class: "btn min-w-14 rounded-none border-0 px-3",
      "aria-pressed": String(state.period === next),
      onclick: () => {
        state.period = next;
        drawPeriod();
        changed();
      },
    }, next);
  const am = periodButton("AM");
  const pm = periodButton("PM");

  const drawPeriod = () => {
    for (const [button, name] of [[am, "AM"], [pm, "PM"]]) {
      const isOn = state.period === name;
      /** @type {HTMLElement} */ (button).setAttribute("aria-pressed", String(isOn));
      /** @type {HTMLElement} */ (button).className = `btn min-w-14 rounded-none border-0 px-3 ${isOn ? "bg-brand text-white" : "bg-surface text-foreground hover:bg-surface-muted"}`;
    }
  };

  /** One part chosen without the other is not a time yet: say what is missing. */
  const check = () => {
    const isHalf = (state.hour === null) !== (state.minute === null);
    error.hidden = !isHalf;
    error.textContent = isHalf ? (state.hour === null ? "Choose the hour too." : "Choose the minutes too.") : "";
    return !isHalf;
  };

  /** "HH:MM" in 24 hours, or null until both the hour and the minutes are chosen. */
  const getValue = () => {
    if (state.hour === null || state.minute === null) return null;
    const hours = (state.hour % 12) + (state.period === "PM" ? 12 : 0);
    return `${two(hours)}:${two(state.minute)}`;
  };

  drawPeriod();

  const wrapper = h(
    "fieldset",
    { class: "space-y-1", "aria-describedby": `${groupId}-error` },
    h("legend", { class: "field-label" }, label),
    h(
      "div",
      { class: "flex flex-wrap items-end gap-1.5 sm:gap-2" },
      hourSelect,
      h("span", { class: "pb-3 font-semibold", "aria-hidden": "true" }, ":"),
      minuteSelect,
      h("div", { role: "group", "aria-label": `${label}: AM or PM`, class: "flex h-11 overflow-hidden rounded-lg border" }, am, pm),
    ),
    error,
  );

  return Object.assign(wrapper, {
    getValue,
    /** Shows the error and returns false when only the hour or only the minutes are chosen. */
    validate: check,
    /** @param {string | null} next */
    setValue: (next) => {
      const parts = next ? partsOf(next) : null;
      state.hour = parts?.hour ?? null;
      state.minute = parts?.minute ?? null;
      state.period = parts?.period ?? "AM";
      minuteSelect.setOptions(minuteOptions());
      hourSelect.setValue(state.hour);
      minuteSelect.setValue(state.minute);
      drawPeriod();
      check();
    },
  });
}
