import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { ManagedSection, SectionOptions, Term } from "@/types/api";
import SectionsIndex from "./SectionsIndex";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const HONESTY: ManagedSection = {
  id: 10,
  name: "Honesty",
  label: "Grade 7 – Honesty",
  grade_level_id: 1,
  grade: 7,
  level: "JHS",
  shift: "WHOLE_DAY",
  track_id: null,
  track: null,
  adviser_id: 3,
  adviser: "Ana Reyes",
  home_room_id: 4,
  home_room: "Main – 101",
  class_size: 40,
  locked_reason: null,
};

const RIZAL: ManagedSection = {
  ...HONESTY,
  id: 11,
  name: "Rizal",
  label: "Grade 11 – Rizal",
  grade_level_id: 5,
  grade: 11,
  level: "SHS",
  adviser_id: null,
  adviser: null,
  home_room_id: null,
  home_room: null,
  class_size: null,
  track_id: 7,
  track: "Academic",
};

const OPTIONS: SectionOptions = {
  grade_levels: [
    { id: 1, grade: 7, level: "JHS" },
    { id: 5, grade: 11, level: "SHS" },
  ],
  tracks: [{ id: 7, name: "Academic" }],
  teachers: [
    { id: 3, name: "Ana Reyes", advises_section_id: 10, advises: "Grade 7 – Honesty" },
    { id: 4, name: "Ben Cruz", advises_section_id: null, advises: null },
  ],
  rooms: [{ id: 4, label: "Main – 101" }],
};

type Call = { url: string; method: string; body: Record<string, unknown> };

function openPage(sections: ManagedSection[] = [HONESTY, RIZAL], reply: unknown = { data: HONESTY }, status = 200) {
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
      const data = url.includes("section-options") ? OPTIONS : url.includes("/sections") ? sections : [TERM];
      return new Response(JSON.stringify({ data }), { status: 200 });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["terms"], [TERM]);
  client.setQueryData(["school-years", 1, "sections"], sections);
  client.setQueryData(["school-years", 1, "section-options"], OPTIONS);

  render(
    <QueryClientProvider client={client}>
      <SelectedTermProvider>
        <SectionsIndex />
      </SelectedTermProvider>
    </QueryClientProvider>,
  );

  return calls;
}

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));
/** The table and phone cards are both in the page, so the table is searched only. */
const table = () => within(screen.getByRole("table", { hidden: true }));

describe("sections page", () => {
  it("lists sections with their details", () => {
    openPage();

    expect(screen.getByText("2 in SY 2026-2027")).toBeInTheDocument();
    const rows = table();
    expect(rows.getByText("Grade 7 – Honesty")).toBeInTheDocument();
    expect(rows.getByText("Ana Reyes")).toBeInTheDocument();
    expect(rows.getByText("Main – 101")).toBeInTheDocument();
    expect(rows.getByText("Academic")).toBeInTheDocument();
  });

  it("counts the sections with no adviser", () => {
    openPage();

    expect(screen.getByText("1 section has no adviser yet.")).toBeInTheDocument();
  });

  it("searches and filters", async () => {
    openPage();

    await userEvent.type(screen.getByLabelText("Search"), "rizal");
    expect(table().queryByText("Grade 7 – Honesty")).not.toBeInTheDocument();
    expect(table().getByText("Grade 11 – Rizal")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Grade level"), "7");
    expect(screen.getByText("No section matches your search.")).toBeInTheDocument();
  });

  it("explains an empty year", () => {
    openPage([]);

    expect(screen.getByText(/no sections in this school year yet/)).toBeInTheDocument();
  });
});

describe("section form", () => {
  it("adds a JHS section", async () => {
    const calls = openPage(undefined, { data: HONESTY }, 201);

    await click("Add section");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Grade level", hidden: false }), "1");
    await userEvent.type(screen.getByLabelText("Section name"), "Hope");
    await userEvent.selectOptions(screen.getByLabelText("Adviser (optional)"), "4");
    await userEvent.selectOptions(screen.getByLabelText("Home room (optional)"), "4");
    await userEvent.type(screen.getByLabelText("Class size (optional)"), "38");
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/school-years\/1\/sections$/);
    expect(calls[0].body).toEqual({
      grade_level_id: 1,
      name: "Hope",
      shift: "WHOLE_DAY",
      track_id: null,
      adviser_id: 4,
      home_room_id: 4,
      class_size: 38,
    });
  });

  it("needs a grade and a name", async () => {
    const calls = openPage();

    await click("Add section");
    await click("Save");

    expect(await screen.findByText("Enter a name")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Grade level" })).toHaveAttribute("aria-invalid", "true");
    expect(calls).toHaveLength(0);
  });

  it("shows a track for SHS and a home room for JHS", async () => {
    openPage();

    await click("Add section");
    const grade = screen.getByRole("combobox", { name: "Grade level" });

    await userEvent.selectOptions(grade, "1");
    expect(screen.getByLabelText("Home room (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Track (optional)")).not.toBeInTheDocument();

    await userEvent.selectOptions(grade, "5");
    expect(screen.getByLabelText("Track (optional)")).toBeInTheDocument();
    expect(screen.queryByLabelText("Home room (optional)")).not.toBeInTheDocument();
  });

  it("adds a new track and selects it", async () => {
    const calls = openPage(undefined, { data: { id: 7, name: "Academic" } }, 201);

    await click("Add section");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Grade level" }), "5");
    await click("New track");
    await userEvent.type(screen.getByLabelText("New track name"), "Academic");
    await click("Add track");

    await waitFor(() => expect(calls[0]?.url).toMatch(/\/tracks$/));
    expect(calls[0].body).toEqual({ name: "Academic" });
    await waitFor(() => expect(screen.getByLabelText("Track (optional)")).toHaveValue("7"));
  });

  it("does not offer a teacher who advises another section", async () => {
    openPage();

    await click("Add section");

    const taken = screen.getByRole("option", { name: "Ana Reyes (advises Grade 7 – Honesty)" });
    expect(taken).toBeDisabled();
  });

  it("keeps the section's own adviser selectable when editing", async () => {
    openPage();

    await userEvent.click(screen.getAllByRole("button", { name: "Edit Grade 7 – Honesty", hidden: true })[0]);

    expect(screen.getByRole("option", { name: "Ana Reyes" })).toBeEnabled();
    expect(screen.getByLabelText("Adviser (optional)")).toHaveValue("3");
  });

  it("locks the grade and shift of a section with work on it", async () => {
    openPage([{ ...HONESTY, locked_reason: "This section already has teacher loading." }]);

    await userEvent.click(screen.getAllByRole("button", { name: "Edit Grade 7 – Honesty", hidden: true })[0]);

    expect(screen.getByRole("combobox", { name: "Grade level" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Shift" })).toBeDisabled();
    expect(screen.getByLabelText("Section name")).toBeEnabled();
    expect(screen.getByText(/Cannot be deleted. This section already has teacher loading/)).toBeInTheDocument();
  });

  it("deletes a free section after asking", async () => {
    const calls = openPage();

    await userEvent.click(screen.getAllByRole("button", { name: "Edit Grade 7 – Honesty", hidden: true })[0]);
    await click("Delete this section");
    expect(calls).toHaveLength(0);
    await click("Yes, delete");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/sections\/10$/);
  });

  it("shows the API's reason when saving fails", async () => {
    openPage(undefined, {
      message: "This grade level already has a section with this name.",
      errors: { name: ["This grade level already has a section with this name."] },
    }, 422);

    await userEvent.click(screen.getAllByRole("button", { name: "Edit Grade 7 – Honesty", hidden: true })[0]);
    await click("Save");

    expect(await screen.findByRole("alert")).toHaveTextContent("already has a section");
  });
});
