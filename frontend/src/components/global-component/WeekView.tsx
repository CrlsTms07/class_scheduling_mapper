import React from "react";
import { subjectColor } from "@/lib/schedule";
import { firstDayToShow, rowsOfDay, type WeekBlock, type WeekCell, type WeekData } from "@/lib/weekGrid";

const CellLines = ({ cell }: { cell: WeekCell }) => (
  <div className={`rounded-md border p-2 ${subjectColor(cell.colorKey)}`}>
    {cell.lines.map((line, position) => (
      <p key={position} className={position === 0 ? "font-medium" : "opacity-85"}>
        {line}
      </p>
    ))}
  </div>
);

/** The whole week in one table, for wide screens and for printing. */
export const WeekTable = ({ week }: { week: WeekData }) => (
  <div className="overflow-x-auto rounded-md border print:overflow-visible">
    <table className="w-full text-left text-xs">
      <thead className="bg-[#790D16]/5 text-neutral-700">
        <tr>
          <th scope="col" className="sticky left-0 z-10 bg-neutral-50 p-2 font-medium whitespace-nowrap print:static">Time</th>
          <th scope="col" className="p-2 font-medium">Mins</th>
          {week.days.map(({ day, name }) => (
            <th key={day} scope="col" className="p-2 font-medium">{name}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {week.rows.map((row) => (
          <tr key={row.key}>
            <td className="sticky left-0 z-10 bg-background p-2 whitespace-nowrap print:static">{row.time}</td>
            <td className="p-2">{row.minutes}</td>
            {row.wideBreak ? (
              <td colSpan={week.days.length} className="bg-neutral-200 p-2 text-center font-medium text-neutral-800">
                {row.wideBreak}
              </td>
            ) : (
              week.days.map(({ day }) =>
                row.breaks?.[day] ? (
                  <td key={day} className="bg-neutral-200 p-2 text-center font-medium text-neutral-800">
                    {row.breaks[day]}
                  </td>
                ) : (
                  <td key={day} className="min-w-28 p-1 align-top print:min-w-0">
                    {(row.cells[day] ?? []).map((cell, index) => (
                      <CellLines key={index} cell={cell} />
                    ))}
                  </td>
                ),
              )
            )}
          </tr>
        ))}
        <tr className="bg-neutral-100 font-medium">
          <td className="p-2" colSpan={2}>{week.totalLabel}</td>
          {week.days.map(({ day }) => (
            <td key={day} className="p-2">{week.totals[day]}</td>
          ))}
        </tr>
      </tbody>
    </table>
  </div>
);

/** One day at a time, for phones. */
const WeekDayList = ({ week }: { week: WeekData }) => {
  const [selected, setSelected] = React.useState(() => firstDayToShow(week.days, new Date().getDay()));
  const rows = rowsOfDay(week.rows, selected);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Day" className="grid grid-cols-5 gap-1">
        {week.days.map(({ day, name }) => (
          <button
            key={day}
            type="button"
            role="tab"
            aria-label={name}
            aria-selected={day === selected}
            onClick={() => setSelected(day)}
            className={`min-h-11 rounded-md border text-xs font-medium ${
              day === selected ? "bg-[#790D16] text-white border-[#790D16]" : "bg-background text-neutral-700"
            }`}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-neutral-700">No classes on this day.</p>}
        {rows.map((row) => {
          const breakLabel = row.wideBreak || row.breaks?.[selected];

          return (
            <div key={row.key} className="space-y-1 text-sm">
              <p className="text-xs text-neutral-700">
                {row.time} · {row.minutes} mins
              </p>
              {breakLabel ? (
                <p className="rounded-md bg-neutral-200 p-2 text-center text-xs font-medium text-neutral-800">
                  {breakLabel}
                </p>
              ) : (
                (row.cells[selected] ?? []).map((cell, index) => <CellLines key={index} cell={cell} />)
              )}
            </div>
          );
        })}
        {rows.length > 0 && (
          <p className="border-t pt-2 text-sm font-medium text-neutral-800">
            {week.totalLabel}: {week.totals[selected]}
          </p>
        )}
      </div>
    </div>
  );
};

type WeekViewProp = {
  week: WeekData;
  /** Separate tables for wide screens, one per bell schedule. */
  blocks?: WeekBlock[];
};

/** Tables on wide screens and when printing, and day tabs on phones. */
const WeekView = ({ week, blocks }: WeekViewProp) => (
  <>
    <div className="hidden space-y-4 md:block print:block">
      {blocks ? (
        blocks.map((block) => (
          <section key={block.name} aria-label={block.name} className="space-y-1 print:break-inside-avoid">
            {blocks.length > 1 && <p className="text-sm font-medium text-teal-700">{block.name}</p>}
            <WeekTable week={block.week} />
          </section>
        ))
      ) : (
        <WeekTable week={week} />
      )}
    </div>
    <div className="md:hidden print:hidden">
      <WeekDayList week={week} />
    </div>
  </>
);

export default WeekView;
