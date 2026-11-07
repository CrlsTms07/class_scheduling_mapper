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
    { id: 50, subject: "Mathematics", is_priority: false, required_minutes: 400, scheduled_minutes: 0, teacher: "Teacher Three" },
  ],
  entries: [],
  rooms: [
    { id: 10, label: "Building – 101" },
    { id: 11, label: "Building – 102" },
  ],
  flags: [],
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
        { id: 1, day: 2, start_time: "08:00", end_time: "09:20", status: "draft", section_subject_id: 60, subject: "English", teacher: "T", room_id: 10, room: "R" },
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

describe("conflicts", () => {
  it("shows who conflicts and lets the user pick a suggested room", async () => {
    const fetchMock = stubApi(plotterData(), () =>
      reply(422, {
        message: "This schedule conflicts with another entry.",
        code: "schedule_conflict",
        conflicts: [{ type: "room", days: [1], message: "Building – 101 is used by Grade 7 – Sample B on Monday at 8:00 AM." }],
        suggestions: { rooms: [{ id: 11, label: "Building – 102" }], slots: [] },
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
        { id: 1, day: 1, start_time: "08:00", end_time: "09:20", status: "draft", section_subject_id: 50, subject: "Mathematics", teacher: "T", room_id: 10, room: "R" },
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
        { id: 1, day: 1, start_time: "08:00", end_time: "09:20", status: "approved", section_subject_id: 50, subject: "Mathematics", teacher: "T", room_id: 10, room: "R" },
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
