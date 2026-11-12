import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { ManagedPattern, Term } from "@/types/api";
import TimeSlotsIndex from "./TimeSlotsIndex";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const PATTERN: ManagedPattern = {
  id: 5,
  level: "JHS",
  shift: "WHOLE_DAY",
  name: "Monday – Thursday",
  days: [1, 2, 3, 4],
  locked_reason: null,
  slots: [
    { id: 50, period_no: 1, label: null, start_time: "07:00", end_time: "07:45", minutes: 45, is_break: false, locked_reason: null },
    { id: 51, period_no: null, label: "Recess", start_time: "07:45", end_time: "08:05", minutes: 20, is_break: true, locked_reason: null },
    { id: 52, period_no: 2, label: null, start_time: "08:05", end_time: "09:25", minutes: 80, is_break: false, locked_reason: "These sections have schedules on it: Grade 7 Honesty." },
  ],
};

type Call = { url: string; method: string; body: Record<string, unknown> };

function openPage(patterns: ManagedPattern[] = [PATTERN], reply: unknown = { data: PATTERN }, status = 200, me: unknown = { role: "super_admin", grade_levels: [] }) {
  const calls: Call[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
      if (init?.method && init.method !== "GET") {
        calls.push({
          url,
          method: init.method,
          body: init.body ? JSON.parse(init.body as string) : {},
        });
        return new Response(JSON.stringify(reply), { status });
      }
      return new Response(JSON.stringify({ data: url.includes("day-patterns") ? patterns : [TERM] }), {
        status: 200,
      });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["terms"], [TERM]);
  client.setQueryData(["school-years", 1, "day-patterns"], patterns);
  client.setQueryData(["me"], me);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SelectedTermProvider>
          <TimeSlotsIndex />
        </SelectedTermProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return calls;
}

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));

describe("time slots page", () => {
  it("shows the periods, breaks and totals of a bell schedule", () => {
    openPage();

    expect(screen.getByText("Bell schedules of SY 2026-2027")).toBeInTheDocument();
    expect(screen.getByText("Monday – Thursday")).toBeInTheDocument();
    expect(screen.getByText("7:00 AM – 7:45 AM")).toBeInTheDocument();
    expect(screen.getByText("Recess, 20 mins")).toBeInTheDocument();
    expect(screen.getByText(/Class time: 125 mins a day. Breaks: 20 mins a day./)).toBeInTheDocument();
  });

  it("warns about days with no bell schedule", () => {
    openPage();

    expect(screen.getByText(/Friday has no bell schedule yet/)).toBeInTheDocument();
  });

  it("only shows the chosen department and shift", async () => {
    openPage();

    await userEvent.click(screen.getByRole("tab", { name: "SHS" }));

    expect(screen.queryByText("Monday – Thursday")).not.toBeInTheDocument();
    expect(screen.getByText(/Monday, Tuesday, Wednesday, Thursday, Friday have no/)).toBeInTheDocument();
  });

  it("explains what to do when there is no school year", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }))));
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    client.setQueryData(["terms"], []);

    render(
      <QueryClientProvider client={client}>
        <SelectedTermProvider>
          <TimeSlotsIndex />
        </SelectedTermProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Start a school year first/)).toBeInTheDocument();
  });
});

describe("bell schedules", () => {
  it("adds one for the chosen department and shift", async () => {
    const calls = openPage(undefined, { data: PATTERN }, 201);

    await click("Add bell schedule");
    await userEvent.type(screen.getByLabelText("Name"), "Friday");
    await click("Friday");
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/school-years\/1\/day-patterns$/);
    expect(calls[0].body).toEqual({ level: "JHS", shift: "WHOLE_DAY", name: "Friday", days: [5] });
  });

  it("needs at least one day", async () => {
    const calls = openPage();

    await click("Add bell schedule");
    await userEvent.type(screen.getByLabelText("Name"), "Friday");
    await click("Save");

    expect(await screen.findByText("Pick at least one day")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("copies to another shift by default and then shows that shift", async () => {
    const calls = openPage(undefined, { data: PATTERN }, 201);

    await click("Copy");
    expect(screen.getByLabelText("Shift", { selector: "#copy-shift" })).toHaveValue("AM");
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/day-patterns\/5\/copy$/);
    expect(calls[0].body).toMatchObject({ shift: "AM", days: [1, 2, 3, 4] });
    await waitFor(() => expect(screen.getByLabelText("Shift")).toHaveValue("AM"));
  });

  it("shows the API's reason when a day is taken", async () => {
    openPage(undefined, {
      message: "One of these days already belongs to Friday.",
      errors: { days: ["One of these days already belongs to Friday."] },
    }, 422);

    await click("Copy");
    await click("Save");

    expect(await screen.findByRole("alert")).toHaveTextContent("already belongs to Friday");
  });

  it("explains why a bell schedule with schedules cannot be deleted", async () => {
    openPage([{ ...PATTERN, locked_reason: "These sections have schedules on it: Grade 7 Honesty." }]);

    await click("Edit");

    expect(screen.getByText(/Cannot be deleted. These sections/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete this bell schedule" })).not.toBeInTheDocument();
  });
});

describe("periods and breaks", () => {
  it("adds a period starting when the last slot ends", async () => {
    const calls = openPage(undefined, { data: PATTERN }, 201);

    await click("Add period");
    expect(screen.getByLabelText("Starts")).toHaveValue("09:25");

    await userEvent.type(screen.getByLabelText("Ends"), "10:10");
    expect(screen.getByText("45 minutes")).toBeInTheDocument();

    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/day-patterns\/5\/slots$/);
    expect(calls[0].body).toEqual({
      is_break: false,
      label: "",
      start_time: "09:25",
      end_time: "10:10",
    });
  });

  it("adds a break with a ready name", async () => {
    openPage();

    await click("Add break");

    expect(screen.getByLabelText("Break name")).toHaveValue("Break");
    expect(screen.getByRole("button", { name: "Break" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the overlap the API found", async () => {
    openPage(undefined, {
      message: "This overlaps Period 1 (7:00 AM – 7:45 AM).",
      errors: { start_time: ["This overlaps Period 1 (7:00 AM – 7:45 AM)."] },
    }, 422);

    await click("Add period");
    await userEvent.type(screen.getByLabelText("Ends"), "10:10");
    await click("Save");

    expect(await screen.findByRole("alert")).toHaveTextContent("overlaps Period 1");
  });

  it("locks the times of a slot that has schedules but keeps the name editable", async () => {
    openPage();

    await click("Edit Period 2, 8:05 AM – 9:25 AM");

    expect(screen.getByText(/The times are locked/)).toBeInTheDocument();
    expect(screen.getByLabelText("Starts")).toBeDisabled();
    expect(screen.getByLabelText("Ends")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Break" })).toBeDisabled();
    expect(screen.getByLabelText("Name (optional)")).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Delete this period" })).not.toBeInTheDocument();
  });

  it("deletes a free slot after asking", async () => {
    const calls = openPage();

    await click("Edit Period 1, 7:00 AM – 7:45 AM");
    await click("Delete this period");
    expect(calls).toHaveLength(0);
    await click("Yes, delete");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/time-slots\/50$/);
  });
});

describe("presets", () => {
  it("fills an empty bell schedule with 8, 10, 14 or 16 rows", async () => {
    const calls = openPage([{ ...PATTERN, slots: [] }]);

    await click("Use a preset");
    expect(screen.getByRole("list", { name: "Preview" }).children).toHaveLength(10);

    await click("8");
    expect(screen.getByRole("list", { name: "Preview" }).children).toHaveLength(8);
    await click("Create these 8 rows");

    await waitFor(() => expect(calls[0]?.url).toMatch(/\/day-patterns\/5\/slots\/preset$/));
    const slots = calls[0].body.slots as { is_break: boolean; label: string; start_time: string }[];
    expect(slots).toHaveLength(8);
    expect(slots.filter(({ is_break }) => is_break).map(({ label }) => label)).toEqual(["Recess", "Lunch"]);
    expect(slots[0].start_time).toBe("07:30");
  });

  it("is not offered once a bell schedule has periods", () => {
    openPage();

    expect(screen.queryByRole("button", { name: "Use a preset" })).not.toBeInTheDocument();
  });
});

describe("a department with no bell schedule yet", () => {
  it("says what to do, with a tip for Senior High shifts", async () => {
    openPage([PATTERN]);

    await userEvent.click(screen.getByRole("tab", { name: "SHS" }));

    expect(screen.getByText(/No SHS bell schedule for the/)).toBeInTheDocument();
    expect(screen.getByText(/AM and a PM shift/)).toBeInTheDocument();
  });
});

describe("for a Master Teacher", () => {
  it("shows the Senior High bell schedules only, with no department choice", () => {
    openPage([PATTERN, { ...PATTERN, id: 99, level: "SHS", name: "Monday – Friday" }], undefined, 200, {
      role: "master_teacher",
      grade_levels: [{ id: 5, grade: 11, level: "SHS" }],
    });

    expect(screen.getByText(/Bell schedules of SY 2026-2027, Senior High/)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "JHS" })).not.toBeInTheDocument();
  });
});
