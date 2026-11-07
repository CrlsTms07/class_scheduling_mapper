import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import RoomSchedulePage from "@/features/schedule/RoomSchedulePage";
import type { RoomSchedule, ScheduleMap, SectionSummary, Term } from "@/types/api";
import Schedule from "./Schedule";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const section = (id: number, name: string): SectionSummary => ({
  id,
  name,
  grade: 7,
  level: "JHS",
  adviser: null,
  status: "draft",
});

const room = (id: number, room_number: string, sections: SectionSummary[] = []) => ({
  id,
  room_number,
  room_name: null,
  is_active: true,
  sections,
});

const MAP: ScheduleMap = {
  buildings: [
    { id: 1, name: "Annex", rooms: [room(1, "201")] },
    { id: 2, name: "Main", rooms: [room(2, "101", [section(5, "Honesty")]), room(3, "102")] },
  ],
  unassigned: [section(6, "Faith")],
};

const ROOM: RoomSchedule = {
  room: { id: 2, label: "Main – 101", room_name: null, capacity: 40, building: "Main" },
  sections: ["Grade 7 – Honesty"],
  entries: [
    { id: 1, day: 1, start_time: "07:00", end_time: "07:45", minutes: 45, status: "draft", subject: "Math 7", teacher: "Ana Reyes", section_id: 5, section: "Grade 7 – Honesty", can_open: true },
    { id: 2, day: 2, start_time: "07:00", end_time: "07:45", minutes: 45, status: "draft", subject: "Science 9", teacher: "Ben Cruz", section_id: 9, section: "Grade 9 – Outside", can_open: false },
  ],
};

function openPage(path = "/schedule", map = MAP) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: map }))));

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["terms"], [TERM]);
  client.setQueryData(["terms", 2, "schedule-map"], map);
  client.setQueryData(["terms", 2, "rooms", 2, "schedule"], ROOM);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SelectedTermProvider>
          <Routes>
            <Route path="schedule" element={<Schedule />} />
            <Route path="schedule/rooms/:roomId" element={<RoomSchedulePage />} />
          </Routes>
        </SelectedTermProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("schedule page", () => {
  it("opens on the first building that has sections", () => {
    openPage();

    expect(screen.getByRole("tab", { name: "Main" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Room: 101")).toBeInTheDocument();
    expect(screen.queryByText("Room: 201")).not.toBeInTheDocument();
  });

  it("links a section to its plotter and a room to its schedule", () => {
    openPage();

    expect(screen.getByRole("link", { name: /Grade 7 – Honesty/ })).toHaveAttribute(
      "href",
      "/schedule/sections/5",
    );
    expect(screen.getByRole("link", { name: "Room schedule of 101" })).toHaveAttribute(
      "href",
      "/schedule/rooms/2",
    );
  });

  it("switches buildings", async () => {
    openPage();

    await userEvent.click(screen.getByRole("tab", { name: "Annex" }));

    expect(screen.getByText("Room: 201")).toBeInTheDocument();
    expect(screen.queryByText("Room: 101")).not.toBeInTheDocument();
  });

  it("has a tab for sections with no room", async () => {
    openPage();

    await userEvent.click(screen.getByRole("tab", { name: "No room yet" }));

    expect(screen.getByRole("link", { name: /Grade 7 – Faith/ })).toBeInTheDocument();
  });

  it("searches across every building and shows sections with no room", async () => {
    openPage();

    await userEvent.type(screen.getByLabelText("Search rooms and sections"), "201");
    expect(screen.getByText("Room: 201")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Main" })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search rooms and sections"));
    await userEvent.type(screen.getByLabelText("Search rooms and sections"), "faith");
    expect(screen.getByRole("link", { name: /Grade 7 – Faith/ })).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search rooms and sections"));
    await userEvent.type(screen.getByLabelText("Search rooms and sections"), "nothing here");
    expect(screen.getByText("Nothing matches your search.")).toBeInTheDocument();
  });

  it("explains an empty school", () => {
    openPage("/schedule", { buildings: [], unassigned: [] });

    expect(screen.getByText(/no rooms or sections/)).toBeInTheDocument();
  });
});

describe("room schedule page", () => {
  it("shows the classes of each day, and which days are free", () => {
    openPage("/schedule/rooms/2");

    expect(screen.getByText("Main – 101")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Monday" })).toHaveTextContent("Math 7");
    expect(screen.getByRole("region", { name: "Monday" })).toHaveTextContent("Ana Reyes");
    expect(screen.getByRole("region", { name: "Wednesday" })).toHaveTextContent("free all day");
  });

  it("only links the sections the user may open", () => {
    openPage("/schedule/rooms/2");

    expect(screen.getByRole("link", { name: /Grade 7 – Honesty/ })).toHaveAttribute(
      "href",
      "/schedule/sections/5",
    );
    expect(screen.queryByRole("link", { name: /Grade 9 – Outside/ })).not.toBeInTheDocument();
    expect(screen.getByText("Grade 9 – Outside", { selector: "p" })).toBeInTheDocument();
  });
});
