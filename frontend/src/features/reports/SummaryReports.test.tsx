import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AdviserSummaryData, GradeTimetableData, TeacherLoadData } from "@/types/api";
import { AdviserSummaryReport, GradeTimetableReport, TeacherLoadReport } from "./SummaryReports";

function open(page: ReactElement, data: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data }))));

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{page}</QueryClientProvider>,
  );
}

const LOAD: TeacherLoadData = {
  term_label: "First Term, School Year 2026-2027",
  summary: { teachers: 1, overloaded: 1, over_hours: 0 },
  teachers: [
    {
      id: 1,
      name: "Ana Reyes",
      department: "Mathematics",
      assigned: 6,
      limit: 5,
      is_overloaded: true,
      minutes: 900,
      duration: "15 hours",
      classes: ["Grade 7 – Honesty: Math 7"],
      hours_per_week: 15,
      max_hours: 30,
      is_over_hours: false,
      loads: [{ section_id: 4, section: "Grade 7 – Honesty", subject: "Math 7", hours_per_week: 15 }],
    },
  ],
};

const TIMETABLE: GradeTimetableData = {
  grade: 7,
  title: "GRADE 7 – TIMETABLE",
  term_label: "First Term, School Year 2026-2027",
  isDraft: true,
  tables: [
    {
      name: "Monday – Thursday",
      sections: [
        { id: 5, label: "Honesty" },
        { id: 6, label: "Hope" },
      ],
      rows: [
        {
          key: 1,
          time: "7:00 AM – 7:45 AM",
          minutes: 45,
          break: null,
          cells: {
            5: [{ subject: "Math 7", teacher: "Ana Reyes", room: "Main – 101", days: null }],
            6: [{ subject: "Science 7", teacher: "Ben Cruz", room: null, days: "Mon, Tue" }],
          },
        },
        { key: 2, time: "7:45 AM – 8:05 AM", minutes: 20, break: "RECESS", cells: { 5: [], 6: [] } },
      ],
    },
  ],
};

describe("Teacher Load Report", () => {
  it("shows each teacher, and marks an overload", async () => {
    open(<TeacherLoadReport termId={2} />, LOAD);

    expect(await screen.findByText("Ana Reyes")).toBeInTheDocument();
    expect(screen.getByText("Overloaded")).toBeInTheDocument();
    expect(screen.getByText(/6 of 5 assigned · 900 minutes a week · Mathematics/)).toBeInTheDocument();
    expect(screen.getByText("Grade 7 – Honesty: Math 7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Teacher Load Report as PDF" })).toBeInTheDocument();
  });

  it("says when nobody has loading", async () => {
    open(<TeacherLoadReport termId={2} />, { ...LOAD, teachers: [], summary: { teachers: 0, overloaded: 0 } });

    expect(await screen.findByText("No teacher has loading yet.")).toBeInTheDocument();
  });
});

describe("Grade Level Timetable", () => {
  it("shows the sections side by side, with breaks and partial days", async () => {
    open(<GradeTimetableReport termId={2} grade={7} />, TIMETABLE);

    const table = within(await screen.findByRole("table"));

    expect(table.getByText("Honesty")).toBeInTheDocument();
    expect(table.getByText("Math 7")).toBeInTheDocument();
    expect(table.getByText("Science 7 (Mon, Tue)")).toBeInTheDocument();
    expect(table.getByText("RECESS")).toHaveAttribute("colspan", "2");
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("says when the grade has nothing to show", async () => {
    open(<GradeTimetableReport termId={2} grade={7} />, { ...TIMETABLE, tables: [] });

    expect(await screen.findByText(/no sections with a bell schedule/)).toBeInTheDocument();
  });
});

const ADVISERS: AdviserSummaryData = {
  term_label: "School Year 2026-2027",
  summary: { sections: 2, without_adviser: 1 },
  grades: [
    {
      grade: 7,
      title: "GRADE 7",
      sections: [
        { number: 1, id: 1, name: "Honesty", room: "101", adviser: "Ana Reyes", co_adviser: "Ben Cruz" },
        { number: 2, id: 2, name: "Hope", room: null, adviser: null, co_adviser: null },
      ],
    },
  ],
};

describe("Adviser Summary", () => {
  it("lists each grade's sections with room, adviser and co-adviser", async () => {
    open(<AdviserSummaryReport termId={2} />, ADVISERS);

    const grade = within(await screen.findByRole("region", { name: "Grade 7 advisers" }));
    expect(grade.getByText("GRADE 7")).toBeInTheDocument();
    expect(grade.getByText("101")).toBeInTheDocument();
    expect(grade.getByText("Ana Reyes")).toBeInTheDocument();
    expect(grade.getByText("Ben Cruz")).toBeInTheDocument();
    expect(grade.getByText("No adviser yet")).toBeInTheDocument();
    expect(screen.getByText("2 sections, 1 without an adviser.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Adviser Summary as PDF" })).toBeInTheDocument();
  });

  it("says when there are no sections", async () => {
    open(<AdviserSummaryReport termId={2} />, { ...ADVISERS, grades: [], summary: { sections: 0, without_adviser: 0 } });

    expect(await screen.findByText("No section has been encoded for this school year yet.")).toBeInTheDocument();
  });
});
