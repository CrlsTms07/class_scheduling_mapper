import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import Login from "@/pages/Login";

type Call = { url: string; body: Record<string, unknown> };

function openLogin() {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
      if (url.includes("/auth/providers")) return new Response(JSON.stringify({ data: { google: false } }));
      const body = init.body ? JSON.parse(init.body as string) : {};
      calls.push({ url, body });
      if (url.endsWith("/login")) {
        return new Response(
          JSON.stringify({ code_required: true, sent_to: "an***@deped.gov.ph", minutes: 10, message: "We sent a 6-digit code to your DepEd email." }),
          { status: 202 },
        );
      }
      if (url.endsWith("/login/code")) {
        return new Response(JSON.stringify({ data: { id: 1, first_name: "Ana", last_name: "Reyes", role: "teacher", grade_levels: [] } }));
      }
      return new Response(JSON.stringify({ data: null }));
    }),
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route path="*" element={<p>Home page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return calls;
}

describe("sign-in code", () => {
  it("asks for the code sent to the DepEd email, then signs in, remembering the device", async () => {
    const calls = openLogin();

    await userEvent.type(screen.getByLabelText("Email"), "ana.reyes@deped.gov.ph");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Check your DepEd email")).toBeInTheDocument();
    expect(screen.getByText("an***@deped.gov.ph")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Send a new code \(\d+s\)/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Remember this device for 30 days" })).toBeChecked();

    // Only digits are kept, up to six.
    await userEvent.type(screen.getByLabelText("Sign-in code"), "12a3456");
    expect(screen.getByLabelText("Sign-in code")).toHaveValue("123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));

    await waitFor(() => expect(calls.find(({ url }) => url.endsWith("/login/code"))?.body).toEqual({ code: "123456", remember_device: true }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("goes back to the sign-in form to use another account", async () => {
    openLogin();

    await userEvent.type(screen.getByLabelText("Email"), "ana.reyes@deped.gov.ph");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await userEvent.click(await screen.findByRole("button", { name: "Use a different account" }));

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });
});
