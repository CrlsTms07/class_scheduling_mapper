import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { User } from "@/types/api";
import { RequireAuth } from "./RouteGuards";

const USER = {
  id: 1,
  email: "ana.reyes@deped.gov.ph",
  first_name: "Ana",
  middle_name: null,
  last_name: "Reyes",
  suffix: null,
  status: "active",
  role: "teacher",
  personnel: null,
  grade_levels: [],
  terms_accepted_at: "2026-11-10T08:00:00Z",
  must_change_password: true,
} as User;

describe("a temporary password from the Admin", () => {
  it("must be changed before anything else opens", async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
        if (init.method === "PUT") {
          sent.push(JSON.parse(String(init.body)));
          return new Response(JSON.stringify({ data: { ...USER, must_change_password: false } }));
        }
        return new Response(JSON.stringify({ data: USER }));
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["me"], USER);

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="dashboard" element={<p>Dashboard page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Temporary password"), "ERC-ABCD-1234");
    await userEvent.type(screen.getByLabelText("New password"), "NewPassword123!");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "NewPassword12");
    expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Confirm new password"), "3!");

    await userEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    await waitFor(() => expect(sent[0]).toMatchObject({ current_password: "ERC-ABCD-1234", password: "NewPassword123!" }));
  });
});
