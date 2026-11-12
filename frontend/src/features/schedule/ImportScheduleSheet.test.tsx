import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ScheduleImportResult, Term } from "@/types/api";
import ImportScheduleSheet from "./ImportScheduleSheet";

const TERM = { id: 2, name: "First Term", school_year: { id: 1, name: "2026-2027" } } as Term;

const RESULT: ScheduleImportResult = {
  source: "class_program",
  sections_found: ["Grade 11 – STEM 11-1", "Grade 11 – STEM 11-2"],
  total: 2,
  ok: 1,
  errors: 1,
  new_loadings: 0,
  rows: [
    { row: 2, section: "Grade 7 – Hope", day: "Monday", time: "7:15 AM – 8:00 AM", subject: "Math 7", teacher: "", room: "", status: "ok", message: null },
    { row: 3, section: "Grade 7 – Zinc", day: "Monday", time: "7:15 AM – 8:00 AM", subject: "Math 7", teacher: "", room: "", status: "error", message: "This section is not in your grade levels this school year." },
  ],
};

describe("import from a file", () => {
  it("reviews the file first, then imports the good rows", async () => {
    const sent: { url: string; preview: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
        sent.push({ url, preview: (init.body as FormData).get("preview") as string });
        return new Response(JSON.stringify({ data: RESULT }));
      }),
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ImportScheduleSheet term={TERM} onClose={() => {}} />
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("button", { name: /Download the import template/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Schedule file")).toHaveAttribute("accept", ".xlsx,.xls,.pdf");
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();

    await userEvent.upload(screen.getByLabelText("Schedule file"), new File(["x"], "Grade-9 (1).xlsx"));
    expect(screen.getByRole("button", { name: "Grade-9 (1).xlsx" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText(/1 of 2 rows are ready, 1 have problems/)).toBeInTheDocument();
    expect(screen.getByText(/Read from the school's schedule: 2 sections/)).toBeInTheDocument();
    expect(screen.getByText("This section is not in your grade levels this school year.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Use this schedule (1 class)" }));
    expect(await screen.findByText(/Imported 1 class as drafts/)).toBeInTheDocument();

    await waitFor(() => expect(sent.map(({ preview }) => preview)).toEqual(["1", "0"]));
    expect(sent[0].url).toContain("/terms/2/schedule-import");
  });
});

describe("setting up what the file names but the system lacks", () => {
  it("lists what is missing, sets it up on request, then uses the schedule", async () => {
    const missing = {
      sections: { count: 2, names: ["Grade 11 – STEM 11-1", "Grade 11 – STEM 11-2"] },
      bell_schedules: { count: 1, names: ["Senior High, Monday – Friday, 6 periods"] },
      subjects: { count: 0, names: [] },
      teachers: { count: 9, names: ["J. OLOR", "R. PACAO"] },
      rooms: { count: 0, names: [] },
    };
    const first = { ...RESULT, ok: 0, errors: 2, set_up: false, missing };
    const ready = { ...RESULT, ok: 2, errors: 0, set_up: true, missing, rows: RESULT.rows.map((row) => ({ ...row, status: "ok" as const, message: null })) };
    const sent: { preview: string; setUp: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
        const body = init.body as FormData;
        sent.push({ preview: body.get("preview") as string, setUp: body.get("set_up") as string });
        return new Response(JSON.stringify({ data: sent.length === 1 ? first : ready }));
      }),
    );

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ImportScheduleSheet term={TERM} onClose={() => {}} />
      </QueryClientProvider>,
    );

    await userEvent.upload(screen.getByLabelText("Schedule file"), new File(["x"], "cp.xlsx"));
    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(await screen.findByText("Not in the system yet")).toBeInTheDocument();
    expect(screen.getByText("9 teachers")).toBeInTheDocument();
    expect(screen.getByText("J. OLOR, R. PACAO, and 7 more")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use this schedule (0 classes)" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Set these up from the file" }));
    expect(await screen.findByText("Will be set up from the file")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use this schedule (2 classes)" }));

    expect(await screen.findByText(/Also set up: 2 sections, 1 bell schedule, 9 teachers/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to the schedules" })).toBeInTheDocument();
    expect(sent).toEqual([
      { preview: "1", setUp: "0" },
      { preview: "1", setUp: "1" },
      { preview: "0", setUp: "1" },
    ]);
  });
});
