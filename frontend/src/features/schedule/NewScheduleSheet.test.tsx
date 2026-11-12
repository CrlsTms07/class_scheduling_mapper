import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { SectionSummary } from "@/types/api";
import NewScheduleSheet from "./NewScheduleSheet";

const SECTIONS: SectionSummary[] = [
  { id: 5, name: "Honesty", grade: 7, level: "JHS", adviser: "Ana Reyes", status: "approved" },
  { id: 9, name: "Hope", grade: 7, level: "JHS", adviser: null, status: "not_started" },
];

const Where = () => <p>at {useLocation().pathname + useLocation().search}</p>;

function open(sections = SECTIONS, onCopy: (() => void) | undefined = vi.fn()) {
  const onImport = vi.fn();
  render(
    <MemoryRouter initialEntries={["/schedule"]}>
      <Routes>
        <Route path="/schedule" element={<NewScheduleSheet sections={sections} onCopy={onCopy} onImport={onImport} onClose={() => {}} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  return { onImport, onCopy };
}

describe("new schedule", () => {
  it("offers the sections not started first", () => {
    open();

    expect(screen.getByLabelText("1. Section")).toHaveDisplayValue("Grade 7 – Hope (Not started)");
  });

  it("opens the timetable of the chosen section", async () => {
    open();

    await userEvent.click(screen.getByRole("button", { name: /Build it on a timetable/ }));

    expect(screen.getByText("at /schedule/sections/9")).toBeInTheDocument();
  });

  it("opens the timetable with Auto-fill ready", async () => {
    open();

    await userEvent.selectOptions(screen.getByLabelText("1. Section"), "5");
    await userEvent.click(screen.getByRole("button", { name: /Let the system fill it/ }));

    expect(screen.getByText("at /schedule/sections/5?autofill=1")).toBeInTheDocument();
  });

  it("hands over to copying or importing", async () => {
    const { onImport, onCopy } = open();

    await userEvent.click(screen.getByRole("button", { name: /Import from a file/ }));
    await userEvent.click(screen.getByRole("button", { name: /Copy another term/ }));

    expect(onImport).toHaveBeenCalled();
    expect(onCopy).toHaveBeenCalled();
  });

  it("leads to adding a section when there is none", () => {
    open([], undefined);

    expect(screen.getByRole("link", { name: /Add a section/ })).toHaveAttribute("href", "/sections?add=1");
    expect(screen.queryByRole("button", { name: /Copy another term/ })).not.toBeInTheDocument();
  });
});
