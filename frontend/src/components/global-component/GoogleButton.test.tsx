import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import Login from "@/pages/Login";

function openLogin(google: boolean, path = "/login") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      new Response(JSON.stringify(url.includes("/auth/providers") ? { data: { google } } : { data: null })),
    ),
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Continue with Google", () => {
  it("shows once the school has set it up, and goes through the API", async () => {
    openLogin(true);

    const button = await screen.findByRole("link", { name: "Continue with Google" });
    expect(button.getAttribute("href")).toMatch(/\/auth\/google\/redirect$/);
    expect(screen.getByText("or use your email")).toBeInTheDocument();
  });

  it("stays hidden until then", async () => {
    openLogin(false);

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue with Google" })).not.toBeInTheDocument();
  });

  it("says why Google did not sign the user in", async () => {
    openLogin(true, "/login?google=not_deped");

    expect(await screen.findByText("Use your official DepEd Google account (@deped.gov.ph).")).toBeInTheDocument();
  });

  it("says when the new account waits for the Admin", async () => {
    openLogin(true, "/login?google=pending");

    expect(await screen.findByText(/You can sign in once the Admin activates it/)).toBeInTheDocument();
  });
});
