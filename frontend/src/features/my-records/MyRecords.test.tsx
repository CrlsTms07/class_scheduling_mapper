import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { MyProfile, MySchedule, Term } from "@/types/api";
import MyProfilePage from "./MyProfilePage";
import MySchedulePage from "./MySchedulePage";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const SCHEDULE: MySchedule = {
  term_label: "First Term, School Year 2026-2027",
  heading: "ANA REYES",
  details: ["Teacher I", "Mathematics"],
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
  not_final_count: 0,
};

const PROFILE: MyProfile = {
  printed_name: "Ana Reyes",
  email: "ana@deped.gov.ph",
  department: "Mathematics",
  designation: null,
  shift: "WHOLE_DAY",
  max_subjects: 5,
  advisory: "Grade 7 – Honesty",
  assigned: 2,
  tasks: ["ICT Coordinator"],
  qualifications: [
    { degree_level: "Bachelor", degree: "BSEd", major: "Mathematics", school: "CvSU", year_completed: 2015 },
  ],
};

let requested: string[];

function open(page: ReactElement, data: unknown) {
  requested = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      if (url.endsWith(".pdf") || url.endsWith(".xlsx")) {
        return new Response(new Blob(["file"]), { status: 200 });
      }
      return new Response(JSON.stringify({ data: url.includes("/terms/2/") ? data : [TERM] }), { status: 200 });
    }),
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SelectedTermProvider>{page}</SelectedTermProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:file");
  URL.revokeObjectURL = vi.fn();
});

describe("My Schedule", () => {
  it("shows the week as a table and as day tabs", async () => {
    open(<MySchedulePage />, SCHEDULE);

    expect(await screen.findByText("ANA REYES")).toBeInTheDocument();
    expect(screen.getByText("Teacher I · Mathematics")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Math 7")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Friday" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Monday" }));
    expect(within(screen.getByRole("tabpanel")).getByText("Math 7")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Tuesday" }));
    expect(within(screen.getByRole("tabpanel")).getByText("No classes on this day.")).toBeInTheDocument();
  });

  it("says how many classes are not final yet", async () => {
    open(<MySchedulePage />, { ...SCHEDULE, not_final_count: 2 });

    expect(await screen.findByText(/2 more classes are still being prepared/)).toBeInTheDocument();
  });

  it("says so when nothing is approved, without download buttons", async () => {
    open(<MySchedulePage />, { ...SCHEDULE, rows: [], not_final_count: 1 });

    expect(await screen.findByText("You have no approved classes yet.")).toBeInTheDocument();
    expect(screen.getByText(/1 more class is still being prepared/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
  });

  it("downloads as PDF and XLSX", async () => {
    open(<MySchedulePage />, SCHEDULE);

    await userEvent.click(await screen.findByRole("button", { name: "Download My Schedule as XLSX" }));

    await waitFor(() => expect(requested.some((url) => url.endsWith("/terms/2/my-schedule/program.xlsx"))).toBe(true));
    expect(screen.getByRole("button", { name: "Download My Schedule as PDF" })).toBeInTheDocument();
  });

  it("explains an account without a personnel record", async () => {
    open(<MySchedulePage />, null);

    expect(await screen.findByRole("alert")).toHaveTextContent("not linked to a personnel record");
  });
});

describe("My Profile", () => {
  it("shows the record and fills in what is missing", async () => {
    open(<MyProfilePage />, PROFILE);

    expect(await screen.findByText("Ana Reyes")).toBeInTheDocument();
    expect(screen.getByText("ana@deped.gov.ph")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("Whole day")).toBeInTheDocument();
    expect(screen.getByText("2 of 5 at most")).toBeInTheDocument();
    expect(screen.getByText("ICT Coordinator")).toBeInTheDocument();
    expect(screen.getByText("BSEd, major in Mathematics")).toBeInTheDocument();
    expect(screen.getByText("Bachelor · CvSU · 2015")).toBeInTheDocument();
  });

  it("has nothing to edit", async () => {
    open(<MyProfilePage />, PROFILE);

    await screen.findByText("Ana Reyes");

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("explains an account without a personnel record", async () => {
    open(<MyProfilePage />, null);

    expect(await screen.findByRole("alert")).toHaveTextContent("not linked to a personnel record");
  });
});
