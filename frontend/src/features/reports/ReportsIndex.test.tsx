import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { ReportGrid, ReportOptions, RoomUsage, Term } from "@/types/api";
import ReportsIndex from "./ReportsIndex";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const OPTIONS: ReportOptions = {
  sections: [
    { id: 5, label: "Grade 7 – Honesty", level: "JHS" },
    { id: 6, label: "Grade 11 – Rizal", level: "SHS" },
  ],
  teachers: [
    { id: 1, label: "Ana Reyes" },
    { id: 3, label: "Ben Cruz" },
  ],
  rooms: [{ id: 7, label: "Main – 101" }],
};

const GRID: ReportGrid = {
  title: "TEACHER PROGRAM",
  term_label: "First Term, School Year 2026-2027",
  heading: "ANA REYES",
  details: ["Teacher I"],
  days: [
    { day: 1, name: "Monday" },
    { day: 2, name: "Tuesday" },
    { day: 3, name: "Wednesday" },
    { day: 4, name: "Thursday" },
    { day: 5, name: "Friday" },
  ],
  rows: [
    {
      start_time: "07:00",
      end_time: "07:45",
      time: "7:00 AM – 7:45 AM",
      minutes: 45,
      cells: { 1: [["Grade 7 – Honesty", "Math 7", "Main – 101"]], 2: [], 3: [], 4: [], 5: [] },
    },
  ],
  totals: { per_day: { 1: 45, 2: 0, 3: 0, 4: 0, 5: 0 }, week: 45, week_duration: "45 minutes" },
  isDraft: true,
};

const USAGE: RoomUsage = {
  buildings: [
    {
      name: "Main",
      rooms: [
        { id: 7, room_number: "101", room_name: "Lab", periods_per_week: 3, sections: [{ label: "Grade 7 – Honesty", periods_per_week: 3 }] },
        { id: 8, room_number: "102", room_name: null, periods_per_week: 0, sections: [] },
      ],
    },
  ],
};

const blobUrls: string[] = [];

function openPage(options = OPTIONS, downloadStatus = 200) {
  const requested: string[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      if (/\.(pdf|xlsx)$/.test(url)) {
        return downloadStatus === 200
          ? new Response("file", { status: 200, headers: { "Content-Disposition": 'attachment; filename="form.pdf"' } })
          : new Response(JSON.stringify({ message: "The form could not be made." }), { status: downloadStatus });
      }
      const data = url.includes("room-usage") ? USAGE : url.includes("options") ? options : url.includes("/reports/") ? GRID : [TERM];
      return new Response(JSON.stringify({ data }), { status: 200 });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["terms"], [TERM]);
  client.setQueryData(["terms", 2, "report-options"], options);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SelectedTermProvider>
          <ReportsIndex />
        </SelectedTermProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return requested;
}

const openTab = (name: string) => userEvent.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  blobUrls.length = 0;
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});

describe("class program", () => {
  it("downloads the chosen section as PDF and XLSX", async () => {
    const requested = openPage();

    await userEvent.click(screen.getByRole("button", { name: "Download Class Program of Grade 7 – Honesty as PDF" }));
    await waitFor(() => expect(requested.some((url) => url.endsWith("/terms/2/sections/5/class-program.pdf"))).toBe(true));

    await userEvent.click(await screen.findByRole("button", { name: "Download Class Program of Grade 7 – Honesty as XLSX" }));
    await waitFor(() => expect(requested.some((url) => url.endsWith("/terms/2/sections/5/class-program.xlsx"))).toBe(true));
  });

  it("offers the Senior High form too", async () => {
    const requested = openPage();

    await userEvent.selectOptions(screen.getByLabelText("Section"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Download Class Program of Grade 11 – Rizal as PDF" }));

    await waitFor(() => expect(requested.some((url) => url.endsWith("/terms/2/sections/6/class-program.pdf"))).toBe(true));
  });

  it("shows why a download failed", async () => {
    openPage(OPTIONS, 500);

    await userEvent.click(screen.getByRole("button", { name: /as PDF/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be made");
  });

  it("explains when there are no sections", () => {
    openPage({ ...OPTIONS, sections: [] });

    expect(screen.getByText(/no sections in your grade levels/)).toBeInTheDocument();
  });
});

describe("teacher program", () => {
  it("previews the first teacher, with draft mark, classes and totals", async () => {
    openPage();

    await openTab("Teacher Program");

    expect(await screen.findByText("ANA REYES")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    const table = within(screen.getByRole("table", { hidden: true }));
    expect(table.getByText("7:00 AM – 7:45 AM")).toBeInTheDocument();
    expect(table.getByText("Math 7")).toBeInTheDocument();
    expect(screen.getByText("45 minutes")).toBeInTheDocument();
  });

  it("downloads the chosen teacher", async () => {
    const requested = openPage();

    await openTab("Teacher Program");
    await userEvent.selectOptions(screen.getByLabelText("Teacher"), "3");
    await userEvent.click(await screen.findByRole("button", { name: "Download Teacher Program of Ben Cruz as XLSX" }));

    await waitFor(() => expect(requested.some((url) => url.endsWith("/reports/teachers/3/program.xlsx"))).toBe(true));
  });

  it("explains when no teacher has loading", async () => {
    openPage({ ...OPTIONS, teachers: [] });

    await openTab("Teacher Program");

    expect(screen.getByText(/No teacher has loading/)).toBeInTheDocument();
  });
});

describe("room schedule", () => {
  it("downloads the chosen room", async () => {
    const requested = openPage();

    await openTab("Room Schedule");
    await userEvent.click(await screen.findByRole("button", { name: "Download Room Schedule of Main – 101 as PDF" }));

    await waitFor(() => expect(requested.some((url) => url.endsWith("/reports/rooms/7/schedule.pdf"))).toBe(true));
  });
});

describe("room usage", () => {
  it("shows which sections use each room, and rooms not used", async () => {
    const requested = openPage();

    await openTab("Room Usage");

    const main = await screen.findByRole("region", { name: "Main" });
    expect(main).toHaveTextContent("Room 101 – Lab");
    expect(main).toHaveTextContent("Grade 7 – Honesty: 3 periods");
    expect(main).toHaveTextContent("Not used in this term.");

    await userEvent.click(screen.getByRole("button", { name: "Download Room Usage as XLSX" }));
    await waitFor(() => expect(requested.some((url) => url.endsWith("/reports/room-usage.xlsx"))).toBe(true));
  });
});
