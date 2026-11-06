import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { SchoolYear } from "@/types/api";
import SchoolYearsIndex from "./SchoolYearsIndex";

const YEAR: SchoolYear = {
  id: 1,
  name: "2026-2027",
  term_count: 3,
  term_label: "Term",
  start_date: "2026-06-01",
  end_date: "2027-03-31",
  cannot_delete_reason: null,
  counts: { subjects: 12, day_patterns: 2, sections: 8, signatories: 4 },
  terms: [
    { id: 11, term_no: 1, name: "First Term", start_date: "2026-06-01", end_date: "2026-09-15", is_active: true, cannot_remove_reason: "First Term is the active term." },
    { id: 12, term_no: 2, name: "Second Term", start_date: "2026-09-16", end_date: "2026-12-15", is_active: false, cannot_remove_reason: null },
    { id: 13, term_no: 3, name: "Third Term", start_date: "2027-01-04", end_date: "2027-03-31", is_active: false, cannot_remove_reason: "Third Term already has schedules: Grade 7 Honesty." },
  ],
};

type Call = { url: string; method: string; body: Record<string, unknown> };

/** Opens the page and records what it sends. The API answers with the given reply. */
function openPage(years: SchoolYear[] = [YEAR], reply: unknown = { data: YEAR, copied: {} }, status = 200) {
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
      return new Response(JSON.stringify({ data: years }), { status: 200 });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["school-years"], years);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SchoolYearsIndex />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return calls;
}

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));

describe("school years page", () => {
  it("shows each year with its terms and which one is active", () => {
    openPage();

    expect(screen.getByText("SY 2026-2027")).toBeInTheDocument();
    expect(screen.getByText("Active now: First Term")).toBeInTheDocument();
    expect(screen.getByText("Jun 1, 2026 to Mar 31, 2027")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Set as active" })).toHaveLength(2);
  });

  it("explains what to do when there is no year yet", () => {
    openPage([]);

    expect(screen.getByText(/no school year yet/)).toBeInTheDocument();
    expect(screen.getByText("No term is active yet.")).toBeInTheDocument();
  });

  it("asks before switching the active term", async () => {
    const calls = openPage();

    await userEvent.click(screen.getAllByRole("button", { name: "Set as active" })[0]);

    expect(screen.getByText("Set Second Term as active?")).toBeInTheDocument();
    expect(screen.getByText(/First Term will stop being the active term/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await click("Set as active");

    await waitFor(() => expect(calls[0]?.url).toMatch(/\/terms\/12\/activate$/));
    expect(calls[0].method).toBe("PUT");
  });
});

describe("start new school year wizard", () => {
  it("suggests the next year and walks through all four steps", async () => {
    const calls = openPage(undefined, {
      data: { ...YEAR, name: "2027-2028" },
      copied: { subjects: 12, subjects_skipped: 2, day_patterns: 2, time_slots: 20, signatories: 4 },
    }, 201);

    await click("Start New School Year");

    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();
    expect(screen.getByLabelText("School year")).toHaveValue("2027-2028");

    await click("Next");
    expect(await screen.findByText(/Step 2 of 4/)).toBeInTheDocument();
    expect(screen.getByLabelText("Part 3 name")).toHaveValue("Third Term");

    await userEvent.click(screen.getByRole("button", { name: /2 Semesters/ }));
    expect(screen.getByLabelText("Part 1 name")).toHaveValue("First Semester");
    expect(screen.queryByLabelText("Part 3 name")).not.toBeInTheDocument();

    await click("Next");
    expect(await screen.findByText(/Step 3 of 4/)).toBeInTheDocument();
    await userEvent.click(screen.getByText("Section names, one grade up"));

    await click("Next");
    expect(await screen.findByText(/Step 4 of 4/)).toBeInTheDocument();
    expect(screen.getByText(/First Term stays the active term/)).toBeInTheDocument();
    expect(screen.getByText("2 parts")).toBeInTheDocument();
    expect(screen.getByText("Second Semester:")).toBeInTheDocument();
    expect(screen.queryByText("Third Term:")).not.toBeInTheDocument();
    expect(screen.getByText(/Section names, one grade up/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await click("Create school year");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toMatchObject({
      name: "2027-2028",
      start_date: "2027-06-01",
      end_date: "2028-03-31",
      term_label: "Semester",
      copy_from_id: 1,
      copy: { subjects: true, time_slots: true, signatories: true, section_names: true },
    });
    expect(calls[0].body.terms).toHaveLength(2);

    expect(await screen.findByText("School year 2027-2028 is ready")).toBeInTheDocument();
    expect(screen.getByText(/Copied 12 subjects, 2 bell schedules, the report signatories/)).toBeInTheDocument();
    expect(screen.getByText(/2 subjects were not copied/)).toBeInTheDocument();
  });

  it("stops on the first step when the name is wrong", async () => {
    openPage();

    await click("Start New School Year");
    await userEvent.clear(screen.getByLabelText("School year"));
    await userEvent.type(screen.getByLabelText("School year"), "2027");
    await click("Next");

    expect(await screen.findByText("Write the school year like 2027-2028")).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 4/)).toBeInTheDocument();
  });

  it("stops on the terms step when the dates do not fit", async () => {
    openPage();

    await click("Start New School Year");
    await click("Next");
    await screen.findByText(/Step 2 of 4/);
    await userEvent.clear(screen.getByLabelText("Part 1 name"));
    await click("Next");

    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    expect(screen.getByText(/Step 2 of 4/)).toBeInTheDocument();
  });

  it("only lets Custom add or remove terms", async () => {
    openPage();

    await click("Start New School Year");
    await click("Next");
    await screen.findByText(/Step 2 of 4/);

    expect(screen.queryByRole("button", { name: "Add a part" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Custom/ }));
    await click("Add a part");

    expect(screen.getByLabelText("Part 4 name")).toHaveValue("Fourth Term");
    expect(screen.getByRole("button", { name: "Add a part" })).toBeDisabled();
  });

  it("has nothing to copy for the very first year", async () => {
    openPage([]);

    await click("Start New School Year");
    await userEvent.type(screen.getByLabelText("First day"), "2026-06-01");
    await userEvent.type(screen.getByLabelText("Last day"), "2027-03-31");
    await click("Next");
    await screen.findByText(/Step 2 of 4/);
    await click("Next");

    expect(await screen.findByText(/first school year/)).toBeInTheDocument();
  });

  it("shows the API's reason when saving fails", async () => {
    openPage(undefined, {
      message: "These dates overlap school year 2026-2027.",
      errors: { start_date: ["These dates overlap school year 2026-2027."] },
    }, 422);

    await click("Start New School Year");
    await click("Next");
    await screen.findByText(/Step 2 of 4/);
    await click("Next");
    await screen.findByText(/Step 3 of 4/);
    await click("Next");
    await screen.findByText(/Step 4 of 4/);
    await click("Create school year");

    expect(await screen.findByRole("alert")).toHaveTextContent("overlap school year 2026-2027");
  });
});

describe("deleting a school year", () => {
  it("explains why a year cannot be deleted", async () => {
    openPage([{ ...YEAR, cannot_delete_reason: "It has the active term." }]);

    await click("Calendar settings");

    expect(screen.getByText(/Cannot be deleted. It has the active term/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete this school year" })).not.toBeInTheDocument();
  });

  it("asks once more before deleting", async () => {
    const calls = openPage();

    await click("Calendar settings");
    await click("Delete this school year");
    expect(calls).toHaveLength(0);

    await click("Yes, delete");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/school-years\/1$/);
  });
});

describe("calendar settings", () => {
  it("explains why the last term cannot be removed", async () => {
    openPage();

    await click("Calendar settings");

    expect(screen.getByRole("button", { name: "Remove last" })).toBeDisabled();
    expect(screen.getByText(/already has schedules: Grade 7 Honesty/)).toBeInTheDocument();
  });

  it("removes a free last term and sends the changes", async () => {
    const free: SchoolYear = {
      ...YEAR,
      terms: YEAR.terms.map((term) => ({ ...term, cannot_remove_reason: null })),
    };
    const calls = openPage([free]);

    await click("Calendar settings");
    await click("Remove last");
    await click("Save changes");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/school-years\/1$/);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].body.terms).toHaveLength(2);
  });
});
