import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { TeacherLoadData } from "@/types/api";
import LoadDistribution from "./LoadDistribution";

const row = (overrides: Partial<TeacherLoadData["teachers"][number]>): TeacherLoadData["teachers"][number] => ({
  id: 1,
  name: "Ana Reyes",
  department: "Mathematics",
  assigned: 2,
  limit: 5,
  is_overloaded: false,
  minutes: 0,
  duration: "–",
  classes: [],
  hours_per_week: 13.3,
  max_hours: 30,
  is_over_hours: false,
  loads: [{ section_id: 4, section: "Grade 7 – Hope", subject: "Math 7", hours_per_week: 6.7 }],
  ...overrides,
});

const DATA: TeacherLoadData = {
  term_label: "First Term, School Year 2026-2027",
  summary: { teachers: 2, overloaded: 0, over_hours: 1 },
  teachers: [row({}), row({ id: 2, name: "Mark Dela Peña", hours_per_week: 33, is_over_hours: true })],
};

describe("Load Distribution", () => {
  it("puts the heaviest load first and flags the overload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: DATA }))));

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <LoadDistribution termId={2} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/1 over their hours a week/)).toBeInTheDocument();

    const meters = screen.getAllByRole("meter");
    expect(meters[0]).toHaveAccessibleName("Mark Dela Peña: 33 of 30 hours a week");
    expect(meters[1]).toHaveAccessibleName("Ana Reyes: 13.3 of 30 hours a week");
    expect(screen.getAllByText("Overload").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Grade 7 – Hope" })[0]).toHaveAttribute("href", "/teacher-loading?section=4");
  });
});
