import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ManagedBuilding } from "@/types/api";
import BuildingsIndex from "./BuildingsIndex";

const BUILDINGS: ManagedBuilding[] = [
  {
    id: 1,
    name: "Main",
    rooms: [
      { id: 10, room_number: "101", room_name: null, capacity: 40, is_active: true, cannot_delete_reason: "It is the home room of a section. Mark it as not in use instead." },
      { id: 11, room_number: "102", room_name: "Science Lab", capacity: null, is_active: false, cannot_delete_reason: null },
    ],
  },
  { id: 2, name: "Annex", rooms: [] },
];

type Call = { url: string; method: string; body: Record<string, unknown> };

function openPage(reply: unknown = { data: { id: 1 } }, status = 200) {
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
      return new Response(JSON.stringify({ data: BUILDINGS }), { status: 200 });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["buildings"], BUILDINGS);

  render(
    <QueryClientProvider client={client}>
      <BuildingsIndex />
    </QueryClientProvider>,
  );

  return calls;
}

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));

describe("buildings and rooms page", () => {
  it("lists buildings and rooms", () => {
    openPage();

    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("2 rooms")).toBeInTheDocument();
    expect(screen.getByText("Room 102 – Science Lab")).toBeInTheDocument();
    expect(screen.getByText("Not in use")).toBeInTheDocument();
    expect(screen.getByText("No rooms yet.")).toBeInTheDocument();
  });

  it("searches rooms", async () => {
    openPage();

    await userEvent.type(screen.getByLabelText("Search"), "science");

    expect(screen.getByText("Room 102 – Science Lab")).toBeInTheDocument();
    expect(screen.queryByText("Room 101")).not.toBeInTheDocument();
    expect(screen.queryByText("Annex")).not.toBeInTheDocument();
  });

  it("adds a building", async () => {
    const calls = openPage();

    await click("Add building");
    await click("Save");
    expect(await screen.findByText("Enter a name")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Building name"), "Building 14");
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ name: "Building 14" });
  });

  it("adds a room to the right building", async () => {
    const calls = openPage();

    await click("Add room to Annex");
    await userEvent.type(screen.getByLabelText("Room number"), "201");
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/buildings\/2\/rooms$/);
    expect(calls[0].body).toEqual({ room_number: "201", room_name: null, in_charge: null, capacity: null, is_active: true });
  });

  it("marks a room as not in use", async () => {
    const calls = openPage();

    await click("Edit room 101 of Main");
    await userEvent.click(screen.getByRole("checkbox", { name: /In use/ }));
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/rooms\/10$/);
    expect(calls[0].body).toMatchObject({ is_active: false, capacity: 40 });
  });

  it("explains why a used room cannot be deleted", async () => {
    openPage();

    await click("Edit room 101 of Main");

    expect(screen.getByText(/Cannot be deleted. It is the home room/)).toBeInTheDocument();
  });

  it("deletes a free room after asking", async () => {
    const calls = openPage();

    await click("Edit room 102 of Main");
    await click("Delete this room");
    expect(calls).toHaveLength(0);
    await click("Yes, delete");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/rooms\/11$/);
  });

  it("only offers to delete a building with no rooms", async () => {
    openPage();

    await click("Edit building Main");
    expect(screen.getByText(/Cannot be deleted. Remove its rooms first/)).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    await waitFor(() => expect(screen.queryByText(/Remove its rooms first/)).not.toBeInTheDocument());

    await click("Edit building Annex");
    expect(screen.getByRole("button", { name: "Delete this building" })).toBeInTheDocument();
  });

  it("shows the API's reason when saving fails", async () => {
    openPage({
      message: "This building already has a room with this number.",
      errors: { room_number: ["This building already has a room with this number."] },
    }, 422);

    await click("Add room to Main");
    await userEvent.type(screen.getByLabelText("Room number"), "101");
    await click("Save");

    expect(await screen.findByRole("alert")).toHaveTextContent("already has a room");
  });
});

describe("deleting from the list", () => {
  it("deletes a free room after asking", async () => {
    const calls = openPage();

    await click("Delete room 102 of Main");
    expect(screen.getByText("Delete Room 102 of Main?")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    await click("Yes, delete");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/rooms\/11$/);
  });

  it("says why a room or a building with rooms stays", async () => {
    openPage();

    await click("Delete room 101 of Main");
    expect(screen.getByText(/It is the home room of a section/)).toBeInTheDocument();
    await click("Close");

    await click("Delete building Main");
    expect(screen.getByText("Remove its rooms first.")).toBeInTheDocument();
  });

  it("deletes an empty building after asking", async () => {
    const calls = openPage();

    await click("Delete building Annex");
    await click("Yes, delete");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/buildings\/2$/);
  });
});
