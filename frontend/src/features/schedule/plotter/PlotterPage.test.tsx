import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { SelectedTermContext } from "@/context/selectedTerm";
import type { Plotter, Term } from "@/types/api";
import PlotterPage from "./PlotterPage";

const term = { id: 2, name: "Second Term", is_active: true } as Term;

const plotterData = (overrides: Partial<Plotter> = {}): Plotter => ({
  section: {
    id: 1,
    name: "Sample A",
    label: "Grade 7 – Sample A",
    level: "JHS",
    grade: 7,
    shift: "WHOLE_DAY",
    adviser: "Teacher One",
    home_room_id: 10,
  },
  status: "not_started",
  can_plot: true,
  can_edit: true,
  last_review: null,
  patterns: [
    {
      id: 1,
      name: "Monday – Thursday",
      days: [1, 2, 3, 4],
      slots: [
        { id: 100, period_no: 1, label: null, start_time: "08:00", end_time: "09:20", minutes: 80, is_break: false },
        { id: 101, period_no: null, label: "Break", start_time: "09:20", end_time: "09:40", minutes: 20, is_break: true },
      ],
    },
    {
      id: 2,
      name: "Friday",
      days: [5],
      slots: [
        { id: 200, period_no: 1, label: null, start_time: "07:50", end_time: "09:10", minutes: 80, is_break: false },
      ],
    },
  ],
  loading: [
    { id: 50, subject_id: 5, teacher_id: 3, subject: "Mathematics", is_priority: false, required_minutes: 400, scheduled_minutes: 0, teacher: "Teacher Three" },
  ],
  entries: [],
  rooms: [
    { id: 10, label: "Building – 101" },
    { id: 11, label: "Building – 102" },
  ],
  flags: [],
  activities: [{ id: 3, name: "Catch-up Friday" }],
  apply_counts: { grade: 4, all: 9 },
  ...overrides,
});

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

function stubApi(plotter: Plotter, onChange?: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
    if ((init.method ?? "GET") !== "GET" && onChange) return onChange(url, init);
    return reply(200, { data: plotter });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function openPlotter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <SelectedTermContext.Provider
        value={{ terms: [term], term, selectTerm: () => {}, isPending: false }}
      >
        <MemoryRouter initialEntries={["/schedule/sections/1"]}>
          <Routes>
            <Route path="schedule/sections/:sectionId" element={<PlotterPage />} />
          </Routes>
        </MemoryRouter>
      </SelectedTermContext.Provider>
    </QueryClientProvider>,
  );
}

/** jsdom ignores CSS, so the grid and the phone list both exist. This takes the grid's cell. */
const firstCell = (name: string) => screen.findAllByRole("button", { name }).then(([cell]) => cell);

const MONDAY_SLOT = "Monday, 8:00 AM – 9:20 AM";

function changeCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => !String(url).includes("csrf-cookie") && (init?.method ?? "GET") !== "GET",
  );
}

describe("tap to assign", () => {
  it("saves the picked subject on the whole pattern for JHS, in the home room", async () => {
    const fetchMock = stubApi(plotterData(), () => reply(200, { data: plotterData() }));
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: /Mathematics/ }));
    await userEvent.click(await firstCell(MONDAY_SLOT));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));

    const [url, init] = changeCalls(fetchMock)[0];
    expect(url).toMatch(/\/terms\/2\/sections\/1\/slots\/100$/);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      section_subject_id: 50,
      room_id: 10,
      days: [1, 2, 3, 4],
    });
  });

  it("saves only the tapped day for SHS", async () => {
    const shs = plotterData();
    shs.section.level = "SHS";
    const fetchMock = stubApi(shs, () => reply(200, { data: shs }));
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: /Mathematics/ }));
    await userEvent.click(await firstCell(MONDAY_SLOT));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(changeCalls(fetchMock)[0][1].body).days).toEqual([1]);
  });

  it("does not overwrite other days that already have a subject", async () => {
    const plotter = plotterData({
      entries: [
        { id: 1, day: 2, start_time: "08:00", end_time: "09:20", status: "draft", activity_id: null, section_subject_id: 60, subject: "English", teacher: "T", room_id: 10, room: "R" },
      ],
    });
    const fetchMock = stubApi(plotter, () => reply(200, { data: plotter }));
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: /Mathematics/ }));
    await userEvent.click(await firstCell(MONDAY_SLOT));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(changeCalls(fetchMock)[0][1].body).days).toEqual([1, 3, 4]);
  });
});

describe("open slots copied from another term", () => {
  const openSlot = (day: number, overrides = {}) => ({
    id: day,
    day,
    start_time: "08:00",
    end_time: "09:20",
    section_subject_id: null,
    subject: null,
    teacher: null,
    room_id: 11,
    room: "Building – 102",
    status: "draft",
    ...overrides,
  });

  it("saves the picked subject in the room of the open slot", async () => {
    const plotter = plotterData({
      status: "draft",
      entries: [openSlot(1), openSlot(2), openSlot(3), openSlot(4)] as Plotter["entries"],
    });
    const fetchMock = stubApi(plotter, () => reply(200, { data: plotter }));
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: /Mathematics/ }));
    await userEvent.click(await firstCell(MONDAY_SLOT));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(changeCalls(fetchMock)[0][1].body as string)).toMatchObject({
      section_subject_id: 50,
      room_id: 11,
      days: [1, 2, 3, 4],
    });
  });

  it("does not replace a subject on another day", async () => {
    const plotter = plotterData({
      status: "draft",
      entries: [openSlot(1), openSlot(2, { activity_id: null, section_subject_id: 51, subject: "Science", teacher: "Ben" })] as Plotter["entries"],
    });
    const fetchMock = stubApi(plotter, () => reply(200, { data: plotter }));
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: /Mathematics/ }));
    await userEvent.click(await firstCell(MONDAY_SLOT));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));
    expect(JSON.parse(changeCalls(fetchMock)[0][1].body as string).days).toEqual([1, 3, 4]);
  });

  it("opens the sheet when an open slot lost its room", async () => {
    const plotter = plotterData({
      status: "draft",
      section: { ...plotterData().section, home_room_id: null },
      entries: [openSlot(1, { room_id: null, room: null })] as Plotter["entries"],
    });
    const fetchMock = stubApi(plotter);
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: /Mathematics/ }));
    await userEvent.click(await firstCell(MONDAY_SLOT));

    expect(await screen.findByLabelText("Room")).toHaveValue("");
    expect(screen.getByLabelText("Subject")).toHaveValue("50");
    expect(changeCalls(fetchMock)).toHaveLength(0);
  });
});

describe("guidance", () => {
  it("says what is next and how far the section has come", async () => {
    stubApi(plotterData());
    openPlotter();

    expect(await screen.findByText("How this works")).toBeInTheDocument();
    expect(screen.getByText("0 of 1 subject complete")).toBeInTheDocument();
    expect(screen.getByText(/Next: Mathematics. 400 mins left/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("says when every subject is placed", async () => {
    stubApi(
      plotterData({
        loading: [{ ...plotterData().loading[0], scheduled_minutes: 400 }],
      }),
    );
    openPlotter();

    expect(await screen.findByText(/All subjects are placed/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  it("says which subject is being placed, until the user is done", async () => {
    stubApi(plotterData());
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: /^Mathematics/ }));
    expect(screen.getByText("Now placing: Mathematics.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText(/Now placing/)).not.toBeInTheDocument();
  });

  it("is not shown to someone who only views", async () => {
    stubApi(plotterData({ can_plot: false, can_edit: false }));
    openPlotter();

    await screen.findByText("Grade 7 – Sample A");
    expect(screen.queryByText("How this works")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("writes Add subject on empty periods of the phone list", async () => {
    stubApi(plotterData());
    openPlotter();

    expect((await screen.findAllByText("Add subject")).length).toBeGreaterThan(0);
  });
});

describe("clearing the schedule", () => {
  const placed = {
    activity_id: null,
    id: 1,
    day: 1,
    start_time: "08:00",
    end_time: "09:20",
    section_subject_id: 50,
    subject: "Mathematics",
    teacher: "Teacher One",
    room_id: 10,
    room: "Building – 101",
    status: "draft",
  };

  it("asks first, then clears", async () => {
    const plotter = plotterData({ status: "draft", entries: [placed] as Plotter["entries"] });
    const fetchMock = stubApi(plotter, () => reply(200, { data: plotterData() }));
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: "Clear this schedule" }));
    expect(screen.getByText(/removes all 1 classes of Grade 7 – Sample A/)).toBeInTheDocument();
    expect(changeCalls(fetchMock)).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Yes, clear it" }));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));
    const [url, init] = changeCalls(fetchMock)[0];
    expect(String(url)).toContain("/sections/1/schedule");
    expect(init.method).toBe("DELETE");
  });

  it("is not offered when there is nothing, or once submitted", async () => {
    stubApi(plotterData({ status: "pending", can_edit: false, entries: [{ ...placed, status: "pending" }] as Plotter["entries"] }));
    openPlotter();

    await screen.findByText(/locked while it waits/);
    expect(screen.queryByRole("button", { name: "Clear this schedule" })).not.toBeInTheDocument();
  });
});

describe("conflicts", () => {
  it("shows who conflicts and lets the user pick a suggested room", async () => {
    const fetchMock = stubApi(plotterData(), () =>
      reply(422, {
        message: "This schedule conflicts with another entry.",
        code: "schedule_conflict",
        conflicts: [{ type: "room", days: [1], message: "Building – 101 is used by Grade 7 – Sample B on Monday at 8:00 AM." }],
        suggestions: { rooms: [{ id: 11, label: "Building – 102" }], slots: [], teachers: [] },
      }),
    );
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: /Mathematics/ }));
    await userEvent.click(await firstCell(MONDAY_SLOT));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Grade 7 – Sample B on Monday at 8:00 AM");

    await userEvent.click(within(alert).getByRole("button", { name: "Building – 102" }));
    expect(screen.getByLabelText("Room")).toHaveValue("11");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(2));
    expect(JSON.parse(changeCalls(fetchMock)[1][1].body).room_id).toBe(11);
  });

  it("offers free teachers, and changes the teacher loading before saving again", async () => {
    let attempts = 0;
    const fetchMock = stubApi(plotterData(), (url) => {
      if (url.includes("/loading/")) return reply(200, { data: { section: {}, rows: [], teachers: [] } });
      attempts += 1;
      return attempts === 1
        ? reply(422, {
            message: "This schedule conflicts with another entry.",
            code: "schedule_conflict",
            conflicts: [{
              type: "teacher", days: [1], section: "Grade 7 – Sample A", subject: "Mathematics", time: "8:00 AM – 9:20 AM",
              message: "Teacher Three is teaching Grade 7 – Sample A on Monday at 8:00 AM.",
            }],
            suggestions: {
              rooms: [],
              slots: [],
              teachers: [{ id: 8, name: "Teacher Eight", teaches_subject: true, hours_per_week: 12 }],
            },
          })
        : reply(200, { data: plotterData() });
    });
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: /Mathematics/ }));
    await userEvent.click(await firstCell(MONDAY_SLOT));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Teachers free at this time");
    expect(alert).toHaveTextContent("Teaches Mathematics · 12 hrs/week");

    await userEvent.click(within(alert).getByRole("button", { name: /Teacher Eight/ }));
    expect(screen.getByLabelText("Teacher")).toHaveValue("8");
    expect(screen.getByText(/for all of its periods/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(3));
    const [, loadingCall, saveCall] = changeCalls(fetchMock);
    expect(String(loadingCall[0])).toContain("/sections/1/loading/5");
    expect(JSON.parse(loadingCall[1].body).teacher_id).toBe(8);
    expect(String(saveCall[0])).toContain("/slots/100");
  });
});

describe("auto-fill", () => {
  const PLAN = {
    plan_hash: "a".repeat(40),
    placed: 30,
    unplaced_count: 1,
    sections: [{ id: 1, label: "Grade 7 – Sample A", placed: 30, minutes: 1500, unplaced: 1 }],
    unplaced: [
      { section: "Grade 7 – Sample A", subject: "MAPEH", teacher: "Teacher Eight", minutes_left: 45, reason: "Teacher Eight has no free period that matches the section's free periods." },
    ],
    skipped: [],
  };

  it("previews first, then places on Confirm with the plan that was shown", async () => {
    const fetchMock = stubApi(plotterData({ status: "draft" }), (url) =>
      url.endsWith("/auto-fill/preview")
        ? reply(200, { data: PLAN })
        : reply(201, { summary: { ...PLAN, run_id: 4 }, data: plotterData({ status: "draft" }) }),
    );
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: "Auto-fill" }));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "This section only" }));
    expect(await screen.findByText(/30 classes will be placed/)).toBeInTheDocument();
    expect(screen.getByText(/has no free period that matches/)).toBeInTheDocument();
    expect(changeCalls(fetchMock)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await screen.findByText("Done: 30 classes placed as drafts.")).toBeInTheDocument();
    const [url, init] = changeCalls(fetchMock)[1];
    expect(String(url)).toMatch(/\/sections\/1\/auto-fill$/);
    expect(JSON.parse(init.body)).toEqual({ scope: "section", plan_hash: PLAN.plan_hash });
  });

  it("marks auto-filled classes, and offers to undo the last run", async () => {
    const fetchMock = stubApi(
      plotterData({
        status: "draft",
        last_auto_fill: { id: 4, created_at: "2026-11-09T08:00:00+08:00", entries: 12 },
        entries: [
          { id: 1, day: 1, start_time: "08:00", end_time: "09:20", status: "draft", activity_id: null, auto_filled: true, section_subject_id: 50, subject: "Mathematics", teacher: "T", room_id: 10, room: "R" },
        ],
      }),
      () => reply(200, { summary: { removed: 12, kept_locked: 0 }, data: plotterData({ status: "not_started" }) }),
    );
    openPlotter();

    expect(await screen.findAllByLabelText("Auto-filled")).not.toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Undo the last auto-fill" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, undo it" }));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));
    const [url, init] = changeCalls(fetchMock)[0];
    expect(String(url)).toMatch(/\/auto-fill\/4$/);
    expect(init.method).toBe("DELETE");
  });
});

describe("color coding", () => {
  it("turns subject colors off, and keeps the choice on the account", async () => {
    const placed = plotterData({
      entries: [
        { id: 1, day: 1, start_time: "08:00", end_time: "09:20", status: "draft", activity_id: null, section_subject_id: 50, subject: "Mathematics", teacher: "T", room_id: 10, room: "R" },
      ],
    });
    const fetchMock = stubApi(placed, (url) =>
      url.includes("/me/preferences")
        ? reply(200, { data: { id: 7, role: "glc", preferences: { color_coding: false } } })
        : reply(200, { data: placed }),
    );
    openPlotter();

    const cell = await firstCell(MONDAY_SLOT);
    expect(cell.className).not.toContain("bg-background text-neutral-900");

    const toggle = screen.getByRole("switch", { name: "Color coding" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);

    await waitFor(() => expect(screen.getByRole("switch", { name: "Color coding" })).toHaveAttribute("aria-checked", "false"));
    expect((await firstCell(MONDAY_SLOT)).className).toContain("bg-background text-neutral-900");
    const [url, init] = changeCalls(fetchMock)[0];
    expect(String(url)).toContain("/me/preferences");
    expect(JSON.parse(init.body)).toEqual({ color_coding: false });
  });
});

describe("activities", () => {
  const summary = {
    activity: "Catch-up Friday",
    time: "8:00 AM – 9:20 AM",
    sections: [
      { id: 1, label: "Grade 7 – Sample A", days: [1], skipped: null, unplaced: ["Filipino (Monday)"] },
      { id: 2, label: "Grade 7 – Sample B", days: [], skipped: "The schedule is pending, so it cannot change now.", unplaced: [] },
    ],
    placed_sections: 1,
    unplaced_classes: 1,
  };

  it("reviews first, then places the activity on the whole grade", async () => {
    const fetchMock = stubApi(plotterData(), (_url, init) =>
      reply(200, { summary, data: JSON.parse(String(init.body)).preview ? null : plotterData() }),
    );
    openPlotter();

    await userEvent.click(await firstCell(MONDAY_SLOT));
    await userEvent.click(await screen.findByRole("button", { name: "Activity" }));
    await userEvent.selectOptions(screen.getByLabelText("Activity"), "3");
    await userEvent.click(screen.getByRole("button", { name: "All Grade 7 sections (4)" }));
    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(await screen.findByText(/1 section will get it/)).toBeInTheDocument();
    expect(screen.getByText(/Left out: Grade 7 – Sample B/)).toBeInTheDocument();
    expect(screen.getByText(/Grade 7 – Sample A: Filipino \(Monday\)/)).toBeInTheDocument();
    expect(JSON.parse(changeCalls(fetchMock)[0][1].body)).toEqual({
      activity_id: 3, scope: "grade", days: [1], preview: true,
    });

    await userEvent.click(screen.getByRole("button", { name: "Apply to 1 section" }));

    expect(await screen.findByText("Catch-up Friday was placed on 1 section.")).toBeInTheDocument();
    expect(String(changeCalls(fetchMock)[1][0])).toContain("/slots/100/activity");
    expect(JSON.parse(changeCalls(fetchMock)[1][1].body).preview).toBe(false);
  });

  it("shows a placed activity in grey, and opens it as an activity", async () => {
    stubApi(
      plotterData({
        entries: [
          { id: 9, day: 1, start_time: "08:00", end_time: "09:20", status: "draft", section_subject_id: null, activity_id: 3, subject: "Catch-up Friday", teacher: null, room_id: null, room: null },
        ],
      }),
    );
    openPlotter();

    const cell = await firstCell(MONDAY_SLOT);
    expect(cell).toHaveTextContent("Catch-up Friday");
    expect(cell.className).toContain("bg-slate-200");

    await userEvent.click(cell);

    expect(await screen.findByRole("button", { name: "Activity" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Activity")).toHaveValue("3");
    expect(screen.getByRole("button", { name: "Remove from Monday" })).toBeInTheDocument();
  });
});

describe("the entry sheet", () => {
  it("opens with the choices when no subject is picked first", async () => {
    stubApi(plotterData());
    openPlotter();

    await userEvent.click(await firstCell(MONDAY_SLOT));

    expect(await screen.findByLabelText("Subject")).toBeInTheDocument();
    expect(screen.getByLabelText("Room")).toHaveValue("10");
    expect(screen.getByRole("button", { name: "Mon" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Thu" })).toHaveAttribute("aria-pressed", "true");
  });

  it("will not save without a subject", async () => {
    const fetchMock = stubApi(plotterData());
    openPlotter();

    await userEvent.click(await firstCell(MONDAY_SLOT));
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a subject");
    expect(changeCalls(fetchMock)).toHaveLength(0);
  });

  it("removes an entry from the selected days", async () => {
    const plotter = plotterData({
      entries: [
        { id: 1, day: 1, start_time: "08:00", end_time: "09:20", status: "draft", activity_id: null, section_subject_id: 50, subject: "Mathematics", teacher: "T", room_id: 10, room: "R" },
      ],
    });
    const fetchMock = stubApi(plotter, () => reply(200, { data: plotterData() }));
    openPlotter();

    await userEvent.click(await firstCell(MONDAY_SLOT));
    await userEvent.click(await screen.findByRole("button", { name: "Remove from selected days" }));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));
    const [, init] = changeCalls(fetchMock)[0];
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ days: [1] });
  });

  it("does not offer to change an approved entry", async () => {
    const plotter = plotterData({
      entries: [
        { id: 1, day: 1, start_time: "08:00", end_time: "09:20", status: "approved", activity_id: null, section_subject_id: 50, subject: "Mathematics", teacher: "T", room_id: 10, room: "R" },
      ],
    });
    stubApi(plotter);
    openPlotter();

    await userEvent.click(await firstCell(MONDAY_SLOT));

    expect(await screen.findByRole("alert")).toHaveTextContent("approved and cannot be changed");
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove from selected days" })).not.toBeInTheDocument();
  });
});

describe("read-only view", () => {
  it("gives the Admin no way to plot", async () => {
    stubApi(plotterData({ can_plot: false, can_edit: false }));
    openPlotter();

    await screen.findByText("Grade 7 – Sample A");

    expect(screen.queryByRole("button", { name: MONDAY_SLOT })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mathematics/ })).not.toBeInTheDocument();
    expect(screen.getByText("Mathematics")).toBeInTheDocument();
  });
});

describe("submitting", () => {
  const flag = { key: "minutes:1:80", type: "minutes_under", severity: "amber" as const, blocking: false, acknowledged: false, message: "Filipino: 80 of 220 minutes scheduled." };

  it("needs each flag checked, then sends the acknowledgements", async () => {
    const plotter = plotterData({ status: "draft", flags: [flag] });
    const fetchMock = stubApi(plotter, () => reply(200, { data: plotterData({ status: "pending", can_edit: false }) }));
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: "Submit for approval" }));

    const sheet = await screen.findByRole("dialog");
    const confirm = within(sheet).getByRole("button", { name: "Submit for approval" });
    expect(confirm).toBeDisabled();

    await userEvent.click(within(sheet).getByRole("checkbox"));
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));

    const [url, init] = changeCalls(fetchMock)[0];
    expect(url).toMatch(/\/sections\/1\/submit$/);
    expect(JSON.parse(init.body).acknowledged_flags).toEqual(["minutes:1:80"]);
    expect(await screen.findByText(/locked while it waits/)).toBeInTheDocument();
  });

  it("will not submit with open slots", async () => {
    stubApi(plotterData({
      status: "draft",
      flags: [{ ...flag, key: "open_slots", blocking: true, message: "2 open slots are still unfilled." }],
    }));
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: "Submit for approval" }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: "Submit for approval" })).toBeDisabled();
    expect(within(sheet).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("has no submit button before anything is plotted", async () => {
    stubApi(plotterData({ status: "not_started" }));
    openPlotter();

    await screen.findByText("Grade 7 – Sample A");

    expect(screen.queryByRole("button", { name: "Submit for approval" })).not.toBeInTheDocument();
  });
});

describe("after the Admin's decision", () => {
  const rejected = () =>
    plotterData({
      status: "rejected",
      can_edit: false,
      last_review: { action: "reject", remarks: "Please fix Filipino.", reviewed_by: "Demo Admin", created_at: "" },
    });

  it("shows why it was rejected and blocks editing until revised", async () => {
    stubApi(rejected());
    openPlotter();

    expect(await screen.findByText(/Please fix Filipino/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: MONDAY_SLOT })).not.toBeInTheDocument();
  });

  it("reports entries that could not come back after revising", async () => {
    const fetchMock = stubApi(rejected(), () =>
      reply(200, {
        data: plotterData({ status: "draft" }),
        removed: ["Filipino was removed: the room is used by Grade 7 – Sample B."],
      }),
    );
    openPlotter();

    await userEvent.click(await screen.findByRole("button", { name: "Revise this schedule" }));

    await waitFor(() => expect(changeCalls(fetchMock)).toHaveLength(1));
    expect(changeCalls(fetchMock)[0][0]).toMatch(/\/revise$/);
    expect(await screen.findByText(/Filipino was removed/)).toBeInTheDocument();
    expect(await screen.findAllByRole("button", { name: MONDAY_SLOT })).not.toHaveLength(0);
  });

  it("shows the Admin a rejected schedule without a revise button", async () => {
    stubApi({ ...rejected(), can_plot: false });
    openPlotter();

    await screen.findByText(/Please fix Filipino/);

    expect(screen.queryByRole("button", { name: "Revise this schedule" })).not.toBeInTheDocument();
  });

  it("says when an approved schedule is locked", async () => {
    stubApi(plotterData({
      status: "approved",
      can_edit: false,
      last_review: { action: "approve", remarks: null, reviewed_by: "Demo Admin", created_at: "" },
    }));
    openPlotter();

    expect(await screen.findByText(/Approved by Demo Admin/)).toBeInTheDocument();
  });
});

describe("screen states", () => {
  it("explains when there is no bell schedule", async () => {
    stubApi(plotterData({ patterns: [] }));
    openPlotter();

    expect(await screen.findByRole("alert")).toHaveTextContent("No bell schedule");
  });

  it("explains when there is no teacher loading", async () => {
    stubApi(plotterData({ loading: [] }));
    openPlotter();

    expect(await screen.findByRole("alert")).toHaveTextContent("No teacher loading");
  });

  it("shows flags", async () => {
    stubApi(plotterData({ flags: [{ key: "minutes:1:80", type: "minutes_over", severity: "red", blocking: false, acknowledged: false, message: "Homeroom Guidance: 80 of 60 minutes scheduled." }] }));
    openPlotter();

    expect(await screen.findByText("1 flag to check")).toBeInTheDocument();
    expect(screen.getByText("1 urgent")).toBeInTheDocument();
    expect(screen.getByText(/80 of 60 minutes/)).toBeInTheDocument();
  });

  it("switches between Monday – Thursday and Friday", async () => {
    stubApi(plotterData());
    openPlotter();

    await userEvent.click(await screen.findByRole("tab", { name: "Weekly grid" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Friday" }));

    expect(screen.getAllByRole("button", { name: "Friday, 7:50 AM – 9:10 AM" }).length).toBeGreaterThan(0);
  });

  it("opens on day cards, showing every day of the week", async () => {
    stubApi(plotterData());
    openPlotter();

    expect(await screen.findByRole("region", { name: "Monday" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Friday" })).toHaveTextContent("7:50 AM");
    expect(screen.getByRole("tab", { name: "Day cards" })).toHaveAttribute("aria-selected", "true");
  });

  it("remembers the view the user chose", async () => {
    stubApi(plotterData());
    openPlotter();

    await userEvent.click(await screen.findByRole("tab", { name: "Weekly grid" }));
    expect(screen.queryByRole("region", { name: "Monday" })).not.toBeInTheDocument();
    expect(localStorage.getItem("plotter-view")).toBe("grid");
  });
});
