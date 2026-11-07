import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ME_QUERY_KEY } from "@/api/queryClient";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { ManagedSubject, RoleName, SubjectOptions, Term, User } from "@/types/api";
import SubjectsIndex from "./SubjectsIndex";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Semester",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 2, term_label: "Semester" },
};

const MATH: ManagedSubject = {
  id: 10,
  grade_level_id: 1,
  grade: 7,
  level: "JHS",
  track_id: null,
  track: null,
  term_no: null,
  code: "MATH7",
  name: "Mathematics 7",
  subject_type: "core",
  minutes_per_week: 225,
  is_priority: false,
  is_active: true,
  locked_reason: "This subject already has teacher loading.",
};

const ROBOTICS: ManagedSubject = {
  ...MATH,
  id: 11,
  grade_level_id: 5,
  grade: 11,
  level: "SHS",
  track_id: 7,
  track: "TechPro",
  term_no: 2,
  code: null,
  name: "Robotics",
  subject_type: "elective",
  minutes_per_week: 180,
  is_priority: true,
  is_active: false,
  locked_reason: null,
};

const OPTIONS: SubjectOptions = {
  grade_levels: [
    { id: 1, grade: 7, level: "JHS" },
    { id: 5, grade: 11, level: "SHS" },
  ],
  tracks: [{ id: 7, name: "TechPro" }],
  terms: [
    { term_no: 1, name: "First Semester" },
    { term_no: 2, name: "Second Semester" },
  ],
};

const userWith = (role: RoleName): User => ({
  id: 9,
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

type Call = { url: string; method: string; body: Record<string, unknown> };

function openPage(role: RoleName = "glc", reply: unknown = { data: { id: 7, name: "TechPro" } }, status = 200) {
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
      const data = url.includes("subject-options") ? OPTIONS : url.includes("/subjects") ? [MATH, ROBOTICS] : [TERM];
      return new Response(JSON.stringify({ data }), { status: 200 });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(ME_QUERY_KEY, userWith(role));
  client.setQueryData(["terms"], [TERM]);
  client.setQueryData(["school-years", 1, "subjects"], [MATH, ROBOTICS]);
  client.setQueryData(["school-years", 1, "subject-options"], OPTIONS);

  render(
    <QueryClientProvider client={client}>
      <SelectedTermProvider>
        <SubjectsIndex />
      </SelectedTermProvider>
    </QueryClientProvider>,
  );

  return calls;
}

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const openRecord = (name: string) =>
  userEvent.click(screen.getAllByRole("button", { name, hidden: true })[0]);
const table = () => within(screen.getByRole("table", { hidden: true }));

describe("subjects page", () => {
  it("lists subjects, with term names from the school year", () => {
    openPage();

    const rows = table();
    expect(rows.getByText("Mathematics 7")).toBeInTheDocument();
    expect(rows.getByText("Whole year")).toBeInTheDocument();
    expect(rows.getByText("Second Semester")).toBeInTheDocument();
    expect(rows.getByText("TechPro")).toBeInTheDocument();
    expect(rows.getByText("225 mins")).toBeInTheDocument();
    expect(rows.getByText("Priority")).toBeInTheDocument();
    expect(rows.getByText("Not offered")).toBeInTheDocument();
  });

  it("searches and filters", async () => {
    openPage();

    await userEvent.type(screen.getByLabelText("Search"), "robot");
    expect(table().queryByText("Mathematics 7")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search"));
    await userEvent.selectOptions(screen.getByLabelText("When"), "whole");
    expect(table().queryByText("Robotics")).not.toBeInTheDocument();
    expect(table().getByText("Mathematics 7")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Grade level"), "11");
    expect(screen.getByText("No subject matches your search.")).toBeInTheDocument();
  });
});

describe("for a Chairperson or Master Teacher", () => {
  it("adds a JHS subject for the whole year", async () => {
    const calls = openPage();

    await click("Add subject");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Grade level" }), "1");
    await userEvent.type(screen.getByLabelText("Subject name"), "Filipino 7");
    await userEvent.type(screen.getByLabelText("Minutes per week"), "220");
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/school-years\/1\/subjects$/);
    expect(calls[0].body).toEqual({
      grade_level_id: 1,
      track_id: null,
      term_no: null,
      code: null,
      name: "Filipino 7",
      subject_type: "core",
      minutes_per_week: 220,
      is_priority: false,
      is_active: true,
    });
  });

  it("needs a grade, a name and minutes", async () => {
    const calls = openPage();

    await click("Add subject");
    await click("Save");

    expect(await screen.findByText("Enter the subject name")).toBeInTheDocument();
    expect(screen.getByText("Enter the minutes per week")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("offers the school year's terms, and a track only for Senior High", async () => {
    openPage();

    await click("Add subject");
    const grade = screen.getByRole("combobox", { name: "Grade level" });

    await userEvent.selectOptions(grade, "1");
    expect(screen.queryByLabelText("Track (optional)")).not.toBeInTheDocument();

    await userEvent.selectOptions(grade, "5");
    expect(screen.getByLabelText("Track (optional)")).toBeInTheDocument();
    expect(within(screen.getByLabelText("When it is taken")).getByRole("option", { name: "Second Semester" })).toBeInTheDocument();
  });

  it("adds a new track and selects it", async () => {
    const calls = openPage();

    await click("Add subject");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Grade level" }), "5");
    await click("New track");
    await userEvent.type(screen.getByLabelText("New track name"), "TechPro");
    await click("Add track");

    await waitFor(() => expect(calls[0]?.url).toMatch(/\/tracks$/));
    await waitFor(() => expect(screen.getByLabelText("Track (optional)")).toHaveValue("7"));
  });

  it("locks the grade and term of a subject with loading, but not its minutes", async () => {
    openPage();

    await openRecord("Edit Mathematics 7, Grade 7");

    expect(screen.getByText(/Its grade, track and term can no longer change/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Grade level" })).toBeDisabled();
    expect(screen.getByLabelText("When it is taken")).toBeDisabled();
    expect(screen.getByLabelText("Minutes per week")).toBeEnabled();
    expect(screen.getByText(/Cannot be deleted. This subject already has teacher loading/)).toBeInTheDocument();
  });

  it("deletes a free subject after asking", async () => {
    const calls = openPage();

    await openRecord("Edit Robotics, Grade 11");
    await click("Delete this subject");
    expect(calls).toHaveLength(0);
    await click("Yes, delete");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/subjects\/11$/);
  });

  it("shows the API's reason when saving fails", async () => {
    openPage("glc", {
      message: "This grade level already has this subject for the same track and term.",
      errors: { name: ["This grade level already has this subject for the same track and term."] },
    }, 422);

    await openRecord("Edit Robotics, Grade 11");
    await click("Save");

    expect(await screen.findByRole("alert")).toHaveTextContent("already has this subject");
  });
});

describe("for the Admin", () => {
  it("is view only", async () => {
    const calls = openPage("super_admin");

    expect(screen.getByText(/View only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add subject" })).not.toBeInTheDocument();

    await openRecord("View Mathematics 7, Grade 7");

    expect(screen.getByLabelText("Subject name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Cannot be deleted/)).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
