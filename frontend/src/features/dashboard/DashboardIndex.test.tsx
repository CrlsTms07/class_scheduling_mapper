import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ME_QUERY_KEY } from "@/api/queryClient";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { AdminDashboard, RoleName, Term, User } from "@/types/api";
import DashboardIndex from "./DashboardIndex";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const DASHBOARD: AdminDashboard = {
  pending_sections: 3,
  pending_accounts: 1,
  flags: { total: 5, urgent: 2, sections: 4 },
  progress: [
    { grade: 7, level: "JHS", sections: 6, not_started: 1, draft: 2, pending: 3, approved: 0, rejected: 0 },
  ],
  overloaded_teachers: [{ id: 1, name: "Ana Reyes", assigned: 7, limit: 5 }],
  checklist: [
    { key: "calendar", title: "School year and active term", done: true, detail: "First Term is active." },
    { key: "time_slots", title: "Time slots and breaks", done: false, detail: "No bell schedule yet." },
  ],
};

const userWith = (role: RoleName): User => ({
  id: 1,
  email: "demo@deped.gov.ph",
  first_name: "Demo",
  middle_name: null,
  last_name: "User",
  suffix: null,
  status: "active",
  role,
  personnel: null,
  grade_levels: [],
});

function openPage(role: RoleName, terms: Term[] = [TERM], dashboard: AdminDashboard = DASHBOARD) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: dashboard })));
  vi.stubGlobal("fetch", fetchMock);

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(ME_QUERY_KEY, userWith(role));
  client.setQueryData(["terms"], terms);
  client.setQueryData(["terms", 2, "dashboard"], dashboard);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SelectedTermProvider>
          <DashboardIndex />
        </SelectedTermProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return fetchMock;
}

const tile = (label: string) => screen.getByText(label).closest("a") as HTMLElement;

describe("admin dashboard", () => {
  it("shows the counts, each opening its own page", () => {
    openPage("super_admin");

    expect(within(tile("Waiting for approval")).getByText("3")).toBeInTheDocument();
    expect(tile("Waiting for approval")).toHaveAttribute("href", "/approvals");
    expect(within(tile("Flags to check")).getByText("In 4 sections, 2 urgent")).toBeInTheDocument();
    expect(within(tile("Accounts to activate")).getByText("sign-up waiting")).toBeInTheDocument();
    expect(tile("Accounts to activate")).toHaveAttribute("href", "/users");
    expect(tile("Active term")).toHaveAttribute("href", "/school-years");
  });

  it("shows the setup checklist with what is left and where to do it", () => {
    openPage("super_admin");

    expect(screen.getByText("1 of 2 done")).toBeInTheDocument();
    expect(screen.getByText("No bell schedule yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Time slots and breaks" })).toHaveAttribute(
      "href",
      "/time-slots",
    );
    expect(screen.getByRole("link", { name: "Open Time slots and breaks" })).toHaveTextContent("Set up");
    expect(screen.getByRole("link", { name: "Open School year and active term" })).toHaveTextContent("View");
  });

  it("opens the checklist only while something is left to do", () => {
    openPage("super_admin");
    expect(screen.getByText("Setup checklist").closest("details")).toHaveAttribute("open");
  });

  it("folds the checklist when everything is done", () => {
    openPage("super_admin", [TERM], {
      ...DASHBOARD,
      checklist: DASHBOARD.checklist.map((item) => ({ ...item, done: true })),
    });

    expect(screen.getByText("2 of 2 done")).toBeInTheDocument();
    expect(screen.getByText("Setup checklist").closest("details")).not.toHaveAttribute("open");
  });

  it("shows schedules by grade level", () => {
    openPage("super_admin");

    const table = within(screen.getByRole("table", { hidden: true }));
    expect(table.getByText("Grade 7 (JHS)")).toBeInTheDocument();
    expect(table.getByText("Pending approval")).toBeInTheDocument();
  });

  it("lists overloaded teachers, or says there are none", () => {
    openPage("super_admin");
    expect(screen.getByText("7 assigned, limit 5")).toBeInTheDocument();
  });

  it("says when no teacher is overloaded", () => {
    openPage("super_admin", [TERM], { ...DASHBOARD, overloaded_teachers: [] });

    expect(screen.getByText(/No teacher is over their limit/)).toBeInTheDocument();
  });

  it("points to School Years when the system is brand new", () => {
    openPage("super_admin", []);

    expect(screen.getByRole("link", { name: "Go to School Years" })).toHaveAttribute(
      "href",
      "/school-years",
    );
  });
});

describe("other roles", () => {
  it("never asks a Chairperson's screen for the Admin's data", () => {
    const fetchMock = openPage("glc");

    expect(screen.getByText("Active term")).toBeInTheDocument();
    expect(screen.queryByText("Setup checklist")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
