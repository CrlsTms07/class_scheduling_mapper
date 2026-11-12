import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { ApprovalSection, Term } from "@/types/api";
import ApprovalsIndex from "./ApprovalsIndex";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const section = (overrides: Partial<ApprovalSection>): ApprovalSection => ({
  id: 1,
  name: "Honesty",
  label: "Grade 7 – Honesty",
  grade_level_id: 1,
  grade: 7,
  level: "JHS",
  adviser: "Ana Reyes",
  status: "pending",
  pending_count: 40,
  approved_count: 0,
  flags: [],
  ...overrides,
});

const SECTIONS: ApprovalSection[] = [
  section({}),
  section({ id: 2, name: "Hope", label: "Grade 7 – Hope", adviser: "Ben Cruz", flags: [{ key: "x", type: "minutes", severity: "amber", message: "Math: 180 of 220 minutes.", blocking: false, acknowledged: true }] }),
  section({ id: 3, name: "Faith", label: "Grade 8 – Faith", grade_level_id: 2, grade: 8, status: "approved", pending_count: 0, approved_count: 38 }),
  section({ id: 4, name: "Rizal", label: "Grade 11 – Rizal", grade_level_id: 5, grade: 11, level: "SHS", status: "draft", pending_count: 0 }),
];

function openPage() {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
      if ((init.method ?? "GET") === "POST") {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ data: { entries: 40, sections: 1 } }));
      }
      return new Response(JSON.stringify({ data: SECTIONS }));
    }),
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["terms"], [TERM]);
  client.setQueryData(["terms", 2, "approvals"], SECTIONS);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SelectedTermProvider>
          <ApprovalsIndex />
        </SelectedTermProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return calls;
}

const sheet = () => document.querySelector("[data-slot=sheet-content]") as HTMLElement;

describe("approvals", () => {
  it("sums up what waits, and starts on the pending ones", async () => {
    openPage();

    expect(await screen.findByText("Waiting for review")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pending (2)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByText("Grade 7 – Honesty").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Grade 8 – Faith")).toHaveLength(0);

    await userEvent.click(screen.getByRole("tab", { name: "Approved (1)" }));
    expect(screen.getAllByText("Grade 8 – Faith").length).toBeGreaterThan(0);
  });

  it("filters by search, department and grade", async () => {
    openPage();
    await screen.findByText("Waiting for review");

    await userEvent.type(screen.getByLabelText("Search"), "ben cruz");
    expect(screen.getAllByText("Grade 7 – Hope").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Grade 7 – Honesty")).toHaveLength(0);

    await userEvent.clear(screen.getByLabelText("Search"));
    await userEvent.selectOptions(screen.getByLabelText("Department"), "SHS");
    await userEvent.click(screen.getByRole("tab", { name: "All (1)" }));
    expect(screen.getAllByText("Grade 11 – Rizal").length).toBeGreaterThan(0);
  });

  it("approves one section from its row", async () => {
    const calls = openPage();
    await screen.findByText("Waiting for review");

    await userEvent.click(screen.getAllByRole("button", { name: "Approve Grade 7 – Honesty" })[0]);
    await userEvent.click(within(sheet()).getByRole("button", { name: "Confirm approval" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ scope: "section", scope_ref_id: 1, action: "approve" });
    expect(await screen.findByText("Approved 40 entries in 1 section.")).toBeInTheDocument();
  });

  it("acts on everything the filters show at once, and warns about flags", async () => {
    const calls = openPage();
    await screen.findByText("Waiting for review");

    await userEvent.selectOptions(screen.getByLabelText("Grade level"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Approve 2 pending" }));

    expect(within(sheet()).getByText(/Grade 7 – Hope/)).toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Confirm approval" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ scope: "grade_level", scope_ref_id: 1, action: "approve" });
  });
});
