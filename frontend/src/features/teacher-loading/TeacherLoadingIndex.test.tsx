import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { SectionLoading, SectionSummary, Term } from "@/types/api";
import TeacherLoadingIndex from "./TeacherLoadingIndex";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const SECTIONS = [
  { id: 5, name: "Honesty", grade: 7, level: "JHS", adviser: null, status: "draft" },
  { id: 6, name: "Hope", grade: 7, level: "JHS", adviser: null, status: "not_started" },
] as SectionSummary[];

const LOADING: SectionLoading = {
  section: { id: 5, label: "Grade 7 – Honesty", level: "JHS", shift: "PM", track: null, adviser: null },
  teachers: [
    { id: 1, name: "Ana Reyes", shift: "WHOLE_DAY", assigned: 6, limit: 5 },
    { id: 2, name: "Ben Cruz", shift: "AM", assigned: 0, limit: 5 },
  ],
  rows: [
    { subject_id: 10, subject: "Math 7", code: null, minutes_per_week: 225, is_priority: true, is_active: true, teacher_id: 1, teacher: "Ana Reyes", placed_entries: 2, locked_reason: null },
    { subject_id: 11, subject: "Science 7", code: null, minutes_per_week: 225, is_priority: false, is_active: true, teacher_id: null, teacher: null, placed_entries: 0, locked_reason: null },
    { subject_id: 12, subject: "English 7", code: null, minutes_per_week: 225, is_priority: false, is_active: true, teacher_id: 2, teacher: "Ben Cruz", placed_entries: 1, locked_reason: "This subject is on an approved schedule. The Admin must reopen it first." },
  ],
};

type Call = { url: string; method: string; body: Record<string, unknown> };

function openPage(path = "/teacher-loading", replies: { status?: number; body?: unknown } = {}, loading = LOADING) {
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
        if (url.includes("quick-add")) {
          return new Response(JSON.stringify({ data: { id: 3, name: "Carla Lim" } }), { status: 201 });
        }
        return new Response(JSON.stringify(replies.body ?? { data: loading }), { status: replies.status ?? 200 });
      }
      const data = url.includes("/loading") ? loading : url.includes("/sections") ? SECTIONS : [TERM];
      return new Response(JSON.stringify({ data }), { status: 200 });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["terms"], [TERM]);
  client.setQueryData(["terms", 2, "sections"], SECTIONS);
  client.setQueryData(["terms", 2, "sections", 5, "loading"], loading);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SelectedTermProvider>
          <TeacherLoadingIndex />
        </SelectedTermProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return calls;
}

describe("teacher loading page", () => {
  it("opens on the first section and counts what is done", () => {
    openPage();

    expect(screen.getByLabelText("Section")).toHaveValue("5");
    expect(screen.getByText("2 of 3 subjects have a teacher.")).toBeInTheDocument();
    expect(screen.getByLabelText("Teacher of Math 7")).toHaveValue("1");
    expect(screen.getByLabelText("Teacher of Science 7")).toHaveValue("");
  });

  it("links to the plotter of the section", () => {
    openPage();

    expect(screen.getByRole("link", { name: /Open the plotter/ })).toHaveAttribute(
      "href",
      "/schedule/sections/5",
    );
  });

  it("shows each teacher's load while choosing", () => {
    openPage();

    expect(screen.getAllByRole("option", { name: "Ana Reyes (6 of 5)" }).length).toBeGreaterThan(0);
  });

  it("warns about a teacher over the limit or on another shift", () => {
    openPage();

    expect(screen.getByText(/Ana Reyes is over their limit: 6 of 5/)).toBeInTheDocument();
    expect(screen.getByText(/shift is Morning \(AM\), but this section's is Afternoon \(PM\)/)).toBeInTheDocument();
  });

  it("explains an empty section", () => {
    openPage("/teacher-loading", {}, { ...LOADING, rows: [] });

    expect(screen.getByText(/Add them on the Subjects page/)).toBeInTheDocument();
  });
});

describe("assigning", () => {
  it("saves as soon as a teacher is chosen", async () => {
    const calls = openPage();

    await userEvent.selectOptions(screen.getByLabelText("Teacher of Science 7"), "2");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toMatch(/\/terms\/2\/sections\/5\/loading\/11$/);
    expect(calls[0].body).toEqual({ teacher_id: 2 });
  });

  it("removes the teacher when set back to none", async () => {
    const calls = openPage();

    await userEvent.selectOptions(screen.getByLabelText("Teacher of Math 7"), "");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/loading\/10$/);
  });

  it("shows the reason and goes back to the saved teacher when it fails", async () => {
    openPage("/teacher-loading", {
      status: 422,
      body: {
        message: "Ben Cruz is teaching Grade 7 – Hope on Monday at 7:00 AM.",
        errors: { teacher_id: ["Ben Cruz is teaching Grade 7 – Hope on Monday at 7:00 AM."] },
      },
    });

    await userEvent.selectOptions(screen.getByLabelText("Teacher of Math 7"), "2");

    expect(await screen.findByRole("alert")).toHaveTextContent("Ben Cruz is teaching Grade 7 – Hope");
    await waitFor(() => expect(screen.getByLabelText("Teacher of Math 7")).toHaveValue("1"));
  });

  it("locks a subject on a schedule the Admin holds, and says why", () => {
    openPage();

    expect(screen.getByLabelText("Teacher of English 7")).toBeDisabled();
    expect(screen.getByText(/The Admin must reopen it first/)).toBeInTheDocument();
  });
});

describe("adding a new teacher", () => {
  it("is offered in the list, and assigns them right after", async () => {
    const calls = openPage();

    await userEvent.selectOptions(screen.getByLabelText("Teacher of Science 7"), "new");

    expect(screen.getByText(/They will be given Science 7/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("First name"), "Carla");
    await userEvent.type(screen.getByLabelText("Last name"), "Lim");
    await userEvent.click(screen.getByRole("button", { name: "Add and assign" }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0].url).toMatch(/\/teachers\/quick-add$/);
    expect(calls[0].body).toEqual({ first_name: "Carla", last_name: "Lim" });
    expect(calls[1].url).toMatch(/\/loading\/11$/);
    expect(calls[1].body).toEqual({ teacher_id: 3 });
  });

  it("needs both names", async () => {
    const calls = openPage();

    await userEvent.selectOptions(screen.getByLabelText("Teacher of Science 7"), "new");
    await userEvent.click(screen.getByRole("button", { name: "Add and assign" }));

    expect(await screen.findByText("Enter the first name")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("goes back to the saved choice when closed", async () => {
    openPage();

    await userEvent.selectOptions(screen.getByLabelText("Teacher of Science 7"), "new");
    await userEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);

    await waitFor(() => expect(screen.getByLabelText("Teacher of Science 7")).toHaveValue(""));
  });
});
