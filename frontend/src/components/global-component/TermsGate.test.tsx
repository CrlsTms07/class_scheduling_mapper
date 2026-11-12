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
} as User;

function open(user: User) {
  const posted: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
      if (init.method === "POST") {
        posted.push(url);
        return new Response(JSON.stringify({ data: { ...user, terms_accepted_at: "2026-11-12T08:00:00Z" } }));
      }
      return new Response(JSON.stringify({ data: user }));
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["me"], user);

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

  return posted;
}

describe("Terms and Conditions on sign-in", () => {
  it("must be accepted before the dashboard opens", async () => {
    const posted = open({ ...USER, terms_accepted_at: null });

    expect(screen.getByRole("heading", { name: "Terms and Conditions" })).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    await waitFor(() => expect(posted[0]).toContain("/me/accept-terms"));
  });

  it("is not asked again once accepted", () => {
    open({ ...USER, terms_accepted_at: "2026-11-10T08:00:00Z" });

    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });
});
