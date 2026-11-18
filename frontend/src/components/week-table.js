// @ts-check
/**
 * A week on screen: periods down, days across, with the time column kept in place while
 * scrolling sideways. Used for report previews, My Schedule and the Guest view.
 * On phones held upright it becomes day tabs with a list (design rule: grid on wide screens,
 * day by day on phones).
 */
import { h, replace } from "@/lib/dom.js";
import { subjectColor } from "@/lib/schedule.js";

/**
 * @typedef {{ lines: string[], colorKey: number }} WeekCell
 * @typedef {{ key: string, time: string, minutes: number, breakLabel?: string | null, cells: Record<number, WeekCell[]> }} WeekRow
 * @typedef {{ days: { day: number, name: string }[], rows: WeekRow[], totals?: Record<number, string | number>, totalLabel?: string }} WeekData
 */

/**
 * The same text always gets the same color.
 * @param {string | null | undefined} text
 */
export function colorKeyOf(text) {
  return [...(text ?? "")].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
}

/**
 * A Teacher Program or Room Schedule from the API: each cell is section, subject, then teacher or room.
 * @param {{ days: { day: number, name: string }[], rows: { start_time: string, end_time: string, time: string, minutes: number, cells: Record<number, (string | null)[][]> }[], totals: { per_day: Record<number, number> } }} grid
 * @returns {WeekData}
 */
export function weekFromReportGrid(grid) {
  return {
    days: grid.days,
    totals: grid.totals.per_day,
    totalLabel: "Total minutes",
    rows: grid.rows.map((row) => ({
      key: `${row.start_time}-${row.end_time}`,
      time: row.time,
      minutes: row.minutes,
      cells: Object.fromEntries(grid.days.map(({ day }) => [day, (row.cells[day] ?? []).map((lines) => ({ lines: lines.filter((line) => Boolean(line)).map(String), colorKey: colorKeyOf(lines[1]) }))])),
    })),
  };
}

/** @param {WeekCell} cell */
const cellBox = (cell) =>
  h("div", { class: `rounded-lg border p-2 text-sm ${subjectColor(cell.colorKey)}` }, cell.lines.map((line, index) => h("p", { class: index === 0 ? "font-medium leading-tight" : "text-small leading-tight opacity-90" }, line)));

/**
 * The week as a table on wide screens and day tabs on phones.
 * @param {WeekData} week
 */
export function weekTable(week) {
  const wide = h(
    "div",
    { class: "overflow-x-auto rounded-xl border max-md:portrait:hidden" },
    h(
      "table",
      { class: "w-full min-w-[44rem] border-collapse text-sm" },
      h("thead", null, h("tr", { class: "bg-surface-muted" }, h("th", { scope: "col", class: "sticky left-0 z-10 w-36 bg-surface-muted p-2 text-left font-medium" }, "Time"), week.days.map(({ name }) => h("th", { scope: "col", class: "p-2 text-left font-medium" }, name)))),
      h(
        "tbody",
        null,
        week.rows.map((row) =>
          h(
            "tr",
            { class: "border-t" },
            h("th", { scope: "row", class: "sticky left-0 z-10 bg-surface p-2 text-left align-top font-normal" }, h("span", { class: "block font-medium" }, row.time), h("span", { class: "text-small text-muted-foreground" }, `${row.minutes} mins`)),
            row.breakLabel
              ? h("td", { colspan: String(week.days.length), class: "bg-surface-muted p-2 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground" }, row.breakLabel)
              : week.days.map(({ day }) => h("td", { class: "p-1 align-top" }, h("div", { class: "space-y-1" }, (row.cells[day] ?? []).map(cellBox)))),
          ),
        ),
        week.totals
          ? h("tr", { class: "border-t bg-surface-muted font-medium" }, h("th", { scope: "row", class: "sticky left-0 bg-surface-muted p-2 text-left" }, week.totalLabel ?? "Total"), week.days.map(({ day }) => h("td", { class: "p-2" }, String(week.totals?.[day] ?? "–"))))
          : null,
      ),
    ),
  );

  // Phones held upright: one day at a time.
  let shownDay = week.days[0]?.day ?? 1;
  const list = h("div", { class: "space-y-2" });
  const tabs = h("div", { role: "tablist", "aria-label": "Day", class: "grid grid-cols-5 gap-1" });
  const drawPhone = () => {
    replace(tabs, week.days.map(({ day, name }) => h("button", { type: "button", role: "tab", "aria-selected": String(day === shownDay), class: `btn border px-1 ${day === shownDay ? "border-brand bg-brand text-white" : "bg-surface"}`, onclick: () => { shownDay = day; drawPhone(); } }, name.slice(0, 3))));
    const rows = week.rows.filter((row) => row.breakLabel || (row.cells[shownDay] ?? []).length > 0);
    replace(
      list,
      rows.length === 0
        ? h("p", { class: "text-sm text-muted-foreground" }, "Nothing on this day.")
        : rows.map((row) =>
            row.breakLabel
              ? h("div", { class: "flex min-h-11 items-center justify-between rounded-lg bg-surface-muted px-3 text-sm font-semibold uppercase text-muted-foreground" }, h("span", null, row.breakLabel), h("span", { class: "font-normal normal-case" }, row.time))
              : h("div", { class: "space-y-1" }, h("p", { class: "text-small text-muted-foreground" }, `${row.time} · ${row.minutes} mins`), (row.cells[shownDay] ?? []).map(cellBox)),
          ),
      week.totals ? h("p", { class: "pt-1 text-sm font-medium" }, `${week.totalLabel ?? "Total"}: ${week.totals[shownDay] ?? "–"}`) : null,
    );
  };
  drawPhone();
  const phone = h("div", { class: "hidden space-y-3 max-md:portrait:block" }, tabs, list);

  return h("div", null, wide, phone);
}
