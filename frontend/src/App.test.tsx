import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ME_QUERY_KEY } from "@/api/queryClient";
import type { RoleName, User } from "@/types/api";
import App from "./App";

function userWith(role: RoleName): User {
  return {
    id: 1,
    email: "demo@deped.gov.ph",
    first_name: "Demo",
    middle_name: null,
    last_name: "User",
    suffix: null,
    status: "active",
    role,
    personnel: null,
    grade_levels: [],
  };
}

/** Opens the app at a URL, signed in as the given user (null = visitor). */
function openApp(path: string, user: User | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(ME_QUERY_KEY, user);
  client.setQueryData(["terms"], []);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

async function submitLogin(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("route guards", () => {
  it("sends a visitor from a protected page to the login page", async () => {
    openApp("/dashboard", null);
    expect(await screen.findByText("Sign in to your account")).toBeInTheDocument();
  });

  it("shows a page to a role that is allowed", async () => {
    openApp("/my-schedule", userWith("teacher"));
    expect(await screen.findByText("This page is being built.")).toBeInTheDocument();
  });

  it("sends a GLC away from an Admin page to their dashboard", async () => {
    openApp("/users", userWith("glc"));
    expect(await screen.findByText("Welcome, Demo")).toBeInTheDocument();
  });

  it("sends a teacher away from staff pages to their own schedule", async () => {
    openApp("/schedule", userWith("teacher"));
    expect(await screen.findByText("This page is being built.")).toBeInTheDocument();
    expect(screen.queryByText("Schedule Configuration")).not.toBeInTheDocument();
  });

  it("sends a signed-in user away from the login page", async () => {
    openApp("/", userWith("super_admin"));
    expect(await screen.findByText("Welcome, Demo")).toBeInTheDocument();
  });

  it("keeps the guest page open to visitors", async () => {
    openApp("/guest", null);
    expect(await screen.findByText("View Schedule")).toBeInTheDocument();
  });
});

describe("login page", () => {
  it("has a View Schedule button for guests and a sign-up link", async () => {
    openApp("/", null);
    expect(await screen.findByRole("link", { name: "View Schedule" })).toHaveAttribute(
      "href",
      "/guest",
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("stops a non-DepEd email before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openApp("/", null);

    await submitLogin("juan@gmail.com", "Password123!");

    expect(
      await screen.findByText("Use your official DepEd email (@deped.gov.ph)"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains that a pending account is waiting for the Admin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("csrf-cookie")
          ? new Response(null, { status: 204 })
          : reply(403, {
              message: "Your account is waiting for the Admin to activate it.",
              code: "account_pending",
            }),
      ),
    );
    openApp("/", null);

    await submitLogin("juan@deped.gov.ph", "Password123!");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "waiting for the Admin",
    );
  });

  it("opens the home page of the user's role after signing in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("csrf-cookie")
          ? new Response(null, { status: 204 })
          : reply(200, { data: userWith("glc") }),
      ),
    );
    openApp("/", null);

    await submitLogin("demo@deped.gov.ph", "Password123!");

    await waitFor(() =>
      expect(screen.getByText("Welcome, Demo")).toBeInTheDocument(),
    );
  });
});

describe("reset password page", () => {
  it("explains when the link is incomplete", async () => {
    openApp("/reset-password", null);
    expect(await screen.findByRole("alert")).toHaveTextContent("incomplete");
  });

  it("shows the account from the link", async () => {
    openApp("/reset-password?token=abc&email=juan%40deped.gov.ph", null);
    expect(await screen.findByText("juan@deped.gov.ph")).toBeInTheDocument();
  });
});
