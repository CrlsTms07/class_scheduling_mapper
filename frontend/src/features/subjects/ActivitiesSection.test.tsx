import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Activity } from "@/types/api";
import ActivitiesSection from "./ActivitiesSection";

const ACTIVITIES: Activity[] = [
  { id: 1, code: "FLAG", name: "Flag Ceremony", in_use: true },
  { id: 2, code: null, name: "Catch-up Friday", in_use: false },
];

function open(canManage: boolean) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
      return new Response(JSON.stringify(method === "GET" ? { data: ACTIVITIES } : { data: { id: 3 } }), {
        status: method === "POST" ? 201 : 200,
      });
    }),
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ActivitiesSection yearId={1} canManage={canManage} />
    </QueryClientProvider>,
  );

  return calls;
}

describe("activities on the Subjects page", () => {
  it("lists them, and adds a new one", async () => {
    const calls = open(true);

    expect(await screen.findByText("Flag Ceremony")).toBeInTheDocument();
    expect(screen.getByText("Catch-up Friday")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add activity" }));
    await userEvent.type(screen.getByLabelText("Name"), "National Reading Program");
    await userEvent.click(screen.getByRole("button", { name: "Add activity" }));

    await waitFor(() => expect(calls.some(({ method }) => method === "POST")).toBe(true));
    expect(calls.find(({ method }) => method === "POST")).toMatchObject({
      url: expect.stringContaining("/school-years/1/activities"),
      body: { name: "National Reading Program", code: null },
    });
  });

  it("explains why one on a schedule cannot be deleted", async () => {
    open(true);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Flag Ceremony" }));

    expect(screen.getByText(/It is on a schedule/)).toBeInTheDocument();
  });

  it("is view only for the Admin", async () => {
    open(false);

    expect(await screen.findByText("Flag Ceremony")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add activity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
  });
});
