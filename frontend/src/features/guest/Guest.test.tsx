import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GuestSection, GuestSectionList } from "@/types/api";
import GuestSectionPage from "./GuestSectionPage";
import GuestViewIndex from "./GuestViewIndex";

const TERM = { name: "First Term", school_year: "2026-2027" };

const LIST: GuestSectionList = {
  term: TERM,
  sections: [
    { id: 1, name: "Honesty", grade: 7, level: "JHS", track: null, adviser: "Ana Reyes", co_adviser: null, is_ready: true },
    { id: 2, name: "Hope", grade: 7, level: "JHS", track: null, adviser: null, co_adviser: null, is_ready: false },
    { id: 3, name: "Faith", grade: 8, level: "JHS", track: null, adviser: "Ben Cruz", co_adviser: "Carla Lim", is_ready: true },
    { id: 4, name: "Rizal", grade: 11, level: "SHS", track: "Academic", adviser: null, co_adviser: null, is_ready: true },
  ],
};

const READY: GuestSection = {
  id: 1,
  label: "Grade 7 – Honesty",
  term: TERM,
  state: "ready",
  adviser: "Ana Reyes",
  co_adviser: "Ben Cruz",
  week: {
    days: [
      { day: 1, name: "Monday" },
      { day: 2, name: "Tuesday" },
      { day: 3, name: "Wednesday" },
      { day: 4, name: "Thursday" },
      { day: 5, name: "Friday" },
    ],
    patterns: [{ name: "Monday – Friday", days: [1, 2, 3, 4, 5] }],
    totals: { 1: "45 minutes", 2: "–", 3: "–", 4: "–", 5: "–" },
    rows: [
      {
        start_time: "07:00:00",
        end_time: "07:45:00",
        time: "7:00 - 7:45",
        minutes: 45,
        days: [1, 2, 3, 4, 5],
        cells: { 1: { subject: "Math 7", room: "Main – 101" }, 2: null, 3: null, 4: null, 5: null },
        breaks: [],
        wide_break: null,
      },
      {
        start_time: "07:45:00",
        end_time: "08:05:00",
        time: "7:45 - 8:05",
        minutes: 20,
        days: [1, 2, 3, 4, 5],
        cells: { 1: null, 2: null, 3: null, 4: null, 5: null },
        breaks: { 1: "RECESS", 2: "RECESS", 3: "RECESS", 4: "RECESS", 5: "RECESS" },
        wide_break: "RECESS",
      },
    ],
  },
};

let requested: string[];

function open(path: string, reply: (url: string) => Response) {
  requested = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      return reply(url);
    }),
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="guest" element={<GuestViewIndex />} />
          <Route path="guest/sections/:sectionId" element={<GuestSectionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:file");
  URL.revokeObjectURL = vi.fn();
});

describe("before choosing", () => {
  it("lists no section until the guest searches or asks to browse", async () => {
    open("/guest", () => json(LIST));

    expect(await screen.findByRole("button", { name: "Browse all sections" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Honesty/ })).not.toBeInTheDocument();
  });
});

describe("choosing a section", () => {
  beforeEach(async () => {
    open("/guest", () => json(LIST));
    await userEvent.click(await screen.findByRole("button", { name: "Browse all sections" }));
  });

  it("goes from department to grade to section", async () => {
    expect(await screen.findByRole("link", { name: /Honesty/ })).toHaveAttribute("href", "/guest/sections/1");
    expect(screen.getByText("First Term, SY 2026-2027")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Faith/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Grade 8" }));
    expect(screen.getByRole("link", { name: /Faith/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Honesty/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Senior High School" }));
    expect(screen.getByRole("link", { name: /Rizal/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grade 11" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Grade 7" })).not.toBeInTheDocument();
  });

  it("searches sections of every grade, and says when nothing matches", async () => {
    await screen.findByRole("link", { name: /Honesty/ });

    await userEvent.type(screen.getByLabelText("Search"), "HOP");
    expect(screen.getByRole("link", { name: /Grade 7 – Hope/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Honesty/ })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search"));
    await userEvent.type(screen.getByLabelText("Search"), "rizal");
    expect(screen.getByRole("link", { name: /Grade 11 – Rizal/ })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search"), "xyz");
    expect(screen.getByText("No section or adviser matches your search.")).toBeInTheDocument();
  });

  it("finds a section by its adviser or co-adviser, and names them", async () => {
    await screen.findByRole("link", { name: /Honesty/ });

    await userEvent.type(screen.getByLabelText("Search"), "carla");
    const faith = screen.getByRole("link", { name: /Grade 8 – Faith/ });
    expect(faith).toHaveTextContent("Adviser: Ben Cruz");
    expect(screen.getByText("1 section found")).toBeInTheDocument();
  });

  it("marks a section that is not ready", async () => {
    const hope = await screen.findByRole("link", { name: /Hope/ });

    expect(within(hope).getByText("Not ready yet")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Honesty/ })).queryByText("Not ready yet")).not.toBeInTheDocument();
  });
});

describe("with nothing to choose", () => {
  it("says so when no term is active", async () => {
    open("/guest", () => json({ term: null, sections: [] }));

    expect(await screen.findByText("No schedule is open right now.")).toBeInTheDocument();
  });

  it("says so when a department has no sections", async () => {
    open("/guest", () => json({ term: TERM, sections: [] }));
    await userEvent.click(await screen.findByRole("button", { name: "Browse all sections" }));

    expect(await screen.findByText("There are no sections here yet.")).toBeInTheDocument();
  });
});

describe("a section's schedule", () => {
  it("shows the week, with AM or PM, breaks and the adviser", async () => {
    open("/guest/sections/1", () => json(READY));

    expect(await screen.findByRole("heading", { name: "Grade 7 – Honesty" })).toBeInTheDocument();
    expect(screen.getByText("Class Adviser: Ana Reyes")).toBeInTheDocument();
    expect(screen.getByText("Co-Adviser: Ben Cruz")).toBeInTheDocument();

    const table = within(screen.getByRole("table"));
    expect(table.getByText("7:00 AM – 7:45 AM")).toBeInTheDocument();
    expect(table.getByText("Math 7")).toBeInTheDocument();
    expect(table.getByText("RECESS")).toHaveAttribute("colspan", "5");
  });

  it("shows one table per bell schedule, each with its name", async () => {
    const week = READY.state === "ready" ? READY.week : null;
    open("/guest/sections/1", () =>
      json({
        ...READY,
        week: {
          ...week,
          patterns: [
            { name: "Monday – Thursday", days: [1, 2, 3, 4] },
            { name: "Friday", days: [5] },
          ],
        },
      }),
    );

    const tables = await screen.findAllByRole("table");

    expect(tables).toHaveLength(2);
    expect(screen.getByText("Monday – Thursday")).toBeInTheDocument();
    expect(within(tables[0]).getByText("Thursday")).toBeInTheDocument();
    expect(within(tables[0]).queryByText("Friday")).not.toBeInTheDocument();
    expect(within(tables[1]).getByText("Friday")).toBeInTheDocument();
  });

  it("downloads the PDF from the public address", async () => {
    open("/guest/sections/1", (url) => (url.endsWith(".pdf") ? new Response(new Blob(["file"])) : json(READY)));

    await userEvent.click(await screen.findByRole("button", { name: "Download Class Program of Grade 7 – Honesty as PDF" }));

    await waitFor(() => expect(requested.some((url) => url.endsWith("/guest/sections/1/class-program.pdf"))).toBe(true));
  });

  it("prints, and copies the link", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    open("/guest/sections/1", () => json(READY));

    await userEvent.click(await screen.findByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(await screen.findByRole("button", { name: "Link copied" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalled();
  });

  it("shows a QR code of the page when asked", async () => {
    open("/guest/sections/1", () => json(READY));

    const button = await screen.findByRole("button", { name: "QR code" });
    expect(screen.queryByRole("img", { name: /QR code/ })).not.toBeInTheDocument();

    await userEvent.click(button);

    const qr = screen.getByRole("img", { name: "QR code for the schedule of Grade 7 – Honesty" });
    expect(qr.querySelector("svg")).toBeInTheDocument();

    await userEvent.click(button);
    expect(screen.queryByRole("img", { name: /QR code/ })).not.toBeInTheDocument();
  });

  it("shows the link to copy by hand when the browser cannot", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    open("/guest/sections/1", () => json(READY));

    await userEvent.click(await screen.findByRole("button", { name: "Copy link" }));

    expect(await screen.findByText(/Copy this link:/)).toBeInTheDocument();
  });

  it.each([
    ["updating", "Schedule is being updated"],
    ["not_ready", "This schedule is not ready yet"],
  ] as const)("shows only a message when %s", async (state, message) => {
    open("/guest/sections/1", () => json({ id: 1, label: "Grade 7 – Honesty", term: TERM, state }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Print" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
  });

  it("explains a link that is not found", async () => {
    open("/guest/sections/99", () => new Response(JSON.stringify({ message: "Not found." }), { status: 404 }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be found");
  });
});
