import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { ManagedTeacher, PersonnelOptions, Term } from "@/types/api";
import TeachersIndex from "./TeachersIndex";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const ANA: ManagedTeacher = {
  id: 1,
  personnel_type: "teaching",
  first_name: "Ana",
  middle_name: null,
  last_name: "Reyes",
  suffix: null,
  display_name: null,
  printed_name: "Ana Reyes",
  department_id: 3,
  department: "Math",
  designation_id: null,
  designation: null,
  shift: "WHOLE_DAY",
  max_subjects: 5,
  max_hours_per_week: 30,
  is_active: true,
  account_email: "ana@deped.gov.ph",
  advisory: "Grade 7 – Honesty",
  assigned: 6,
  task_ids: [7],
  qualifications: [
    { degree_level: "Bachelor", degree: "BSEd", major: "Math", school: null, year_completed: 2015 },
  ],
  cannot_delete_reason: "It is linked to a user account. The Admin can unlink it in Users.",
};

const BEN: ManagedTeacher = {
  ...ANA,
  id: 2,
  first_name: "Ben",
  last_name: "Cruz",
  printed_name: "Ben Cruz",
  department_id: null,
  department: null,
  account_email: null,
  advisory: null,
  assigned: 0,
  task_ids: [],
  qualifications: [],
  personnel_type: "non_teaching",
  is_active: false,
  cannot_delete_reason: null,
};

const OPTIONS: PersonnelOptions = {
  departments: [{ id: 3, name: "Math" }],
  designations: [{ id: 4, name: "Teacher I" }],
  tasks: [{ id: 7, name: "ICT Coordinator" }],
};

type Call = { url: string; method: string; body: Record<string, unknown> };

function openPage(reply: unknown = { data: { id: 8, name: "Science" } }, status = 200, teachers: ManagedTeacher[] = [ANA, BEN]) {
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
      const data = url.includes("personnel-options") ? OPTIONS : url.includes("/teachers") ? teachers : [TERM];
      return new Response(JSON.stringify({ data }), { status: 200 });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["terms"], [TERM]);
  client.setQueryData(["terms", 2, "teachers"], teachers);
  client.setQueryData(["personnel-options"], OPTIONS);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SelectedTermProvider>
          <TeachersIndex />
        </SelectedTermProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return calls;
}

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const openRecord = (name: string) =>
  userEvent.click(screen.getAllByRole("button", { name, hidden: true })[0]);
const table = () => within(screen.getByRole("table", { hidden: true }));

describe("teachers page", () => {
  it("lists records with load, and warns when over the limit", () => {
    openPage();

    const rows = table();
    expect(rows.getByText("Ana Reyes")).toBeInTheDocument();
    expect(rows.getByText("Over the limit")).toBeInTheDocument();
    expect(rows.getByText("6 of 5")).toBeInTheDocument();
    expect(rows.getByText(/adviser of Grade 7 – Honesty/)).toBeInTheDocument();
    expect(rows.getByText("Inactive")).toBeInTheDocument();
  });

  it("searches and filters", async () => {
    openPage();

    await userEvent.type(screen.getByLabelText("Search"), "cruz");
    expect(table().queryByText("Ana Reyes")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search"));
    await click("Filters");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "active");
    expect(table().queryByText("Ben Cruz")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Type"), "non_teaching");
    expect(screen.getByText("No one matches your search.")).toBeInTheDocument();
  });

  it("adds a record with the defaults filled in", async () => {
    const calls = openPage();

    await click("Add personnel");
    await userEvent.type(screen.getByLabelText("First name"), "Carla");
    await userEvent.type(screen.getByLabelText("Last name"), "Lim");
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/terms\/2\/teachers$/);
    expect(calls[0].body).toEqual({
      personnel_type: "teaching",
      first_name: "Carla",
      middle_name: null,
      last_name: "Lim",
      suffix: null,
      display_name: null,
      department_id: null,
      designation_id: null,
      shift: "WHOLE_DAY",
      max_hours_per_week: 30,
      is_active: true,
      qualifications: [],
      task_ids: [],
    });
  });

  it("needs the names, and shows the one load limit of every teacher", async () => {
    const calls = openPage();

    await click("Add personnel");
    expect(screen.queryByLabelText(/Maximum load/)).not.toBeInTheDocument();
    expect(screen.getByText("5 subjects")).toBeInTheDocument();
    await click("Save");

    expect(await screen.findByText("Enter the first name")).toBeInTheDocument();
    expect(screen.getByText("Enter the last name")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("keeps qualifications and tasks when editing, and can add and remove them", async () => {
    const calls = openPage();

    await openRecord("Edit Ana Reyes");

    expect(screen.getByLabelText("Degree")).toHaveValue("BSEd");
    expect(screen.getByRole("checkbox", { name: "ICT Coordinator" })).toBeChecked();

    await click("Remove qualification 1");
    await click("Add qualification");
    await userEvent.type(screen.getByLabelText("Degree"), "MAEd");
    await userEvent.click(screen.getByRole("checkbox", { name: "ICT Coordinator" }));
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/terms\/2\/teachers\/1$/);
    expect(calls[0].body).toMatchObject({
      qualifications: [{ degree_level: "Bachelor", degree: "MAEd", major: null, school: null, year_completed: null }],
      task_ids: [],
    });
  });

  it("adds a new department from the form and selects it", async () => {
    const calls = openPage({ data: { id: 3, name: "Math" } }, 201);

    await click("Add personnel");
    await click("New department");
    await userEvent.type(screen.getByLabelText("New department name"), "Math");
    await click("Add");

    await waitFor(() => expect(calls[0]?.url).toMatch(/\/personnel-options\/departments$/));
    await waitFor(() => expect(screen.getByLabelText(/^Department/)).toHaveValue("3"));
  });

  it("explains why a record in use cannot be deleted", async () => {
    openPage();

    await openRecord("Edit Ana Reyes");

    expect(screen.getByText(/Cannot be deleted. It is linked to a user account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete this record" })).not.toBeInTheDocument();
  });

  it("deletes a free record after asking", async () => {
    const calls = openPage();

    await openRecord("Edit Ben Cruz");
    await click("Delete this record");
    expect(calls).toHaveLength(0);
    await click("Yes, delete");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/teachers\/2$/);
  });

  it("views a record on its own page", () => {
    openPage();

    expect(screen.getAllByRole("link", { name: "View Ana Reyes", hidden: true })[0]).toHaveAttribute("href", "/teachers/1");
  });

  it("deletes from the list after asking, or says why it cannot", async () => {
    const calls = openPage();

    await openRecord("Delete Ana Reyes");
    expect(screen.getByText("Ana Reyes cannot be deleted")).toBeInTheDocument();
    await click("Close");

    await openRecord("Delete Ben Cruz");
    await click("Yes, delete");
    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/teachers\/2$/);
  });

  it("shows the API's reason when saving fails", async () => {
    openPage({
      message: "This person has an advisory or teacher loading, so they must stay as teaching personnel.",
      errors: { personnel_type: ["This person has an advisory or teacher loading, so they must stay as teaching personnel."] },
    }, 422);

    await openRecord("Edit Ana Reyes");
    await click("Save");

    expect(await screen.findByRole("alert")).toHaveTextContent("must stay as teaching");
  });
});

describe("a teacher of the other department only", () => {
  it("is listed, but opens view only", async () => {
    const carlo: ManagedTeacher = { ...BEN, id: 3, first_name: "Carlo", printed_name: "Carlo Cruz", can_edit: false };
    const calls = openPage(undefined, 200, [ANA, carlo]);

    expect(screen.getAllByRole("button", { name: "Edit Ana Reyes" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "View Carlo Cruz", hidden: true })[0]).toHaveAttribute("href", "/teachers/3");
    expect(screen.getAllByText("View only").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Edit Carlo Cruz", hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Carlo Cruz", hidden: true })).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
