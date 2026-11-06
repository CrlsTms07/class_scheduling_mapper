import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ME_QUERY_KEY } from "@/api/queryClient";
import type { AccessOptions, User } from "@/types/api";
import UsersIndex from "./UsersIndex";

const person = (id: number, first_name: string, overrides: Partial<User> = {}): User => ({
  id,
  email: `${first_name.toLowerCase()}@deped.gov.ph`,
  first_name,
  middle_name: null,
  last_name: "Reyes",
  suffix: null,
  status: "active",
  role: "teacher",
  personnel: null,
  grade_levels: [],
  ...overrides,
});

const ADMIN = person(1, "Admin", { role: "super_admin" });
const PENDING = person(2, "Pending", { status: "pending", role: null });
const TEACHER = person(3, "Linked", { personnel: { id: 30, name: "Linked Reyes" } });
const GONE = person(4, "Gone", { status: "inactive" });
const USERS = [PENDING, ADMIN, TEACHER, GONE];

const OPTIONS: AccessOptions = {
  grade_levels: [
    { id: 1, grade: 7, level: "JHS" },
    { id: 5, grade: 11, level: "SHS" },
  ],
  teachers: [{ id: 31, first_name: "Free", last_name: "Cruz" }],
};

type Call = { url: string; method: string; body: Record<string, unknown> };

function openPage() {
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
        return new Response(JSON.stringify({ data: TEACHER }), { status: 200 });
      }
      const data = url.includes("access-options") ? OPTIONS : USERS;
      return new Response(JSON.stringify({ data }), { status: 200 });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(ME_QUERY_KEY, ADMIN);
  client.setQueryData(["users"], USERS);
  client.setQueryData(["users", "access-options"], OPTIONS);

  render(
    <QueryClientProvider client={client}>
      <UsersIndex />
    </QueryClientProvider>,
  );

  return calls;
}

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const table = () => within(screen.getByRole("table", { hidden: true }));
/** Rows and phone cards are both in the page, so this takes the first match. */
const manage = (name: string) =>
  userEvent.click(screen.getAllByRole("button", { name, hidden: true })[0]);

describe("users page", () => {
  it("says how many accounts are waiting", () => {
    openPage();

    expect(screen.getByText("1 account is waiting for activation.")).toBeInTheDocument();
  });

  it("shows status, role and personnel record", () => {
    openPage();

    const rows = table();
    expect(rows.getByText("Waiting for activation")).toBeInTheDocument();
    expect(rows.getByText("Deactivated")).toBeInTheDocument();
    expect(rows.getByRole("cell", { name: "Linked Reyes" })).toBeInTheDocument();
  });

  it("offers no actions on the Admin's own account", () => {
    openPage();

    expect(screen.queryByRole("button", { name: /Admin Reyes/, hidden: true })).not.toBeInTheDocument();
    expect(table().getByText("This is you")).toBeInTheDocument();
  });

  it("names the right action for each status", () => {
    openPage();

    expect(screen.getAllByRole("button", { name: "Activate: Pending Reyes", hidden: true })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Change access: Linked Reyes", hidden: true })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Reactivate: Gone Reyes", hidden: true })[0]).toBeInTheDocument();
  });

  it("searches and filters", async () => {
    openPage();

    await userEvent.type(screen.getByLabelText("Search"), "pending");
    expect(table().queryByText("Linked Reyes", { selector: "p" })).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Search"));
    await userEvent.selectOptions(screen.getByLabelText("Status"), "inactive");
    expect(table().getByText("Gone Reyes")).toBeInTheDocument();
    expect(table().queryByText("Pending Reyes")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Role"), "glc");
    expect(screen.getByText("No account matches your search.")).toBeInTheDocument();
  });
});

describe("a pending account", () => {
  it("is activated with a role and grade levels", async () => {
    const calls = openPage();

    await manage("Activate: Pending Reyes");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Role" }), "glc");
    await click("Grade 7");
    await click("Save and activate");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/users\/2\/activation$/);
    expect(calls[0].body).toEqual({ role: "glc", grade_level_ids: [1], teacher_id: null });
  });

  it("can be declined after asking", async () => {
    const calls = openPage();

    await manage("Activate: Pending Reyes");
    await click("Decline this sign-up");
    expect(calls).toHaveLength(0);
    await click("Yes, decline");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/users\/2$/);
  });
});

describe("an active account", () => {
  it("keeps its personnel record when access is saved", async () => {
    const calls = openPage();

    await manage("Change access: Linked Reyes");

    expect(screen.getByLabelText(/Personnel record/)).toHaveValue("30");
    expect(screen.getByRole("option", { name: "Linked Reyes (current)" })).toBeInTheDocument();

    await click("Save changes");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ role: "teacher", grade_level_ids: [], teacher_id: 30 });
  });

  it("can be deactivated after a warning", async () => {
    const calls = openPage();

    await manage("Change access: Linked Reyes");
    await click("Deactivate this account");

    expect(screen.getByText(/signed out and cannot sign in/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await click("Yes, deactivate");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/users\/3\/status$/);
    expect(calls[0].body).toEqual({ status: "inactive" });
  });
});

describe("a deactivated account", () => {
  it("can only be brought back, without changing access by accident", async () => {
    const calls = openPage();

    await manage("Reactivate: Gone Reyes");

    expect(screen.queryByRole("combobox", { name: "Role" })).not.toBeInTheDocument();
    await click("Reactivate this account");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/users\/4\/status$/);
    expect(calls[0].body).toEqual({ status: "active" });
  });
});
