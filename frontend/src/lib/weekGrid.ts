import { formatTime } from "@/lib/schedule";
import type { GuestWeek, ReportGrid } from "@/types/api";

export type WeekCell = { lines: string[]; colorKey: number };

export type WeekRow = {
  key: string;
  time: string;
  minutes: number;
  /** The same break on all five days, shown as one wide row. */
  wideBreak?: string | null;
  breaks?: Record<number, string>;
  cells: Record<number, WeekCell[]>;
};

export type WeekData = {
  days: { day: number; name: string }[];
  rows: WeekRow[];
  totals: Record<number, string | number>;
  totalLabel: string;
};

export type WeekBlock = { name: string; week: WeekData };

/** The same subject always gets the same color, even without an id from the API. */
export function colorKeyOf(text: string | null | undefined): number {
  return [...(text ?? "")].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
}

function withoutBlanks(lines: (string | null)[]): string[] {
  return lines.filter((line): line is string => Boolean(line));
}

/** A Teacher Program or Room Schedule: each cell is section, subject, then teacher or room. */
export function weekFromReportGrid(grid: Pick<ReportGrid, "days" | "rows" | "totals">): WeekData {
  return {
    days: grid.days,
    totals: grid.totals.per_day,
    totalLabel: "Total minutes",
    rows: grid.rows.map((row) => ({
      key: `${row.start_time}-${row.end_time}`,
      time: row.time,
      minutes: row.minutes,
      cells: Object.fromEntries(
        grid.days.map(({ day }) => [
          day,
          (row.cells[day] ?? []).map((lines) => ({
            lines: withoutBlanks(lines),
            colorKey: colorKeyOf(lines[1]),
          })),
        ]),
      ),
    })),
  };
}

/** A section's week for the Guest view: each cell is subject, then room. Teachers stay private. */
export function weekFromGuestWeek(week: GuestWeek): WeekData {
  return {
    days: week.days,
    totals: week.totals,
    totalLabel: "Total time",
    rows: week.rows.map((row) => ({
      key: `${row.start_time}-${row.end_time}`,
      time: `${formatTime(row.start_time)} – ${formatTime(row.end_time)}`,
      minutes: row.minutes,
      wideBreak: row.wide_break,
      breaks: row.breaks,
      cells: Object.fromEntries(
        week.days.map(({ day }) => {
          const cell = row.cells[day];

          return [
            day,
            cell
              ? [{ lines: withoutBlanks([cell.subject, cell.room]), colorKey: colorKeyOf(cell.subject) }]
              : [],
          ];
        }),
      ),
    })),
  };
}

/** One table per bell schedule, with only that schedule's days and periods. */
export function blocksFromGuestWeek(week: GuestWeek): WeekBlock[] {
  const whole = weekFromGuestWeek(week);

  return week.patterns.map((pattern) => {
    const days = week.days.filter(({ day }) => pattern.days.includes(day));

    return {
      name: pattern.name,
      week: {
        ...whole,
        days,
        rows: whole.rows.flatMap((row, index) => {
          if (!week.rows[index].days.some((day) => pattern.days.includes(day))) {
            return [];
          }

          const labels = days.map(({ day }) => row.breaks?.[day]);
          const isSameBreak = labels.every((label) => label && label === labels[0]);

          return [{ ...row, wideBreak: isSameBreak ? labels[0] : null }];
        }),
      },
    };
  });
}

/** Monday to Friday opens on today. On a weekend it opens on the first day. */
export function firstDayToShow(days: { day: number }[], today: number): number {
  return days.find(({ day }) => day === today)?.day ?? days[0]?.day ?? 1;
}

/** What to show for one day on a phone: its classes and breaks, without empty periods. */
export function rowsOfDay(rows: WeekRow[], day: number): WeekRow[] {
  return rows.filter((row) => row.wideBreak || row.breaks?.[day] || (row.cells[day] ?? []).length > 0);
}
