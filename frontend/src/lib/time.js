// @ts-check
/**
 * Times in the system. The API sends and receives 24-hour "HH:MM" (like "13:30"), but people
 * only ever see and type 12-hour times with AM or PM (team decision, Nov 17, 2026).
 */

/**
 * "13:05" becomes "1:05 PM"; "00:00" becomes "12:00 AM".
 * @param {string} time  "HH:MM" or "HH:MM:SS"
 */
export function formatTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour < 12 ? "AM" : "PM";

  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * "7:00 AM – 7:45 AM".
 * @param {string} start
 * @param {string} end
 */
export function timeRange(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/**
 * Reads a typed 12-hour time. "7", "7:5", "07:05", "715" and "7.15" all work; the hour is 1–12.
 * Returns "HH:MM" in 24 hours, or null when it is not a time.
 *
 * @param {string} typed  the hour and minutes, like "7:30"
 * @param {"AM" | "PM"} period
 * @returns {string | null}
 */
export function parseTime(typed, period) {
  const clean = typed.trim().replace(/\s+/g, "").replace(".", ":");
  let hour;
  let minute;

  if (/^\d{1,2}$/.test(clean)) {
    hour = Number(clean);
    minute = 0;
  } else if (/^\d{3,4}$/.test(clean)) {
    hour = Number(clean.slice(0, -2));
    minute = Number(clean.slice(-2));
  } else {
    const match = clean.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;
    hour = Number(match[1]);
    minute = Number(match[2]);
  }

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  const hour24 = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Splits "13:30" into what the 12-hour picker shows: "1:30" and "PM".
 * @param {string} time
 * @returns {{ typed: string, period: "AM" | "PM" }}
 */
export function splitTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  return {
    typed: `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")}`,
    period: hour < 12 ? "AM" : "PM",
  };
}

/**
 * Minutes from one time to another: ("07:00", "07:45") is 45.
 * @param {string} start
 * @param {string} end
 */
export function minutesBetween(start, end) {
  const toMinutes = (/** @type {string} */ time) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
  };
  return toMinutes(end) - toMinutes(start);
}
