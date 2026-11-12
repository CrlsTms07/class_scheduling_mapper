import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ME_QUERY_KEY } from "@/api/queryClient";
import { unreadCount } from "@/lib/notifications";
import type { AppNotification } from "@/types/api";
import NotificationBell from "./NotificationBell";
import SignOutButton from "./SignOutButton";

const ITEMS: AppNotification[] = [
  {
    key: "review:2",
    title: "Rejected: Grade 7 – Honesty",
    body: "First Term. Remarks: Too many Math periods.",
    link: "/schedule/sections/5",
    at: "2026-11-07T08:00:00+08:00",
  },
  {
    key: "review:1",
    title: "Approved: Grade 7 – Hope",
    body: "First Term. Teachers and guests can now see it.",
    link: "/schedule/sections/6",
    at: "2026-11-06T08:00:00+08:00",
  },
];

function open(ui: React.ReactElement, items: AppNotification[] = ITEMS) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? "GET" });
      if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
      return new Response(JSON.stringify(url.includes("/notifications") ? { data: items } : { message: "Signed out." }));
    }),
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(ME_QUERY_KEY, { id: 7, first_name: "Demo", last_name: "User", role: "glc" });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

  return { calls, client };
}

describe("sign out", () => {
  it("asks first, and Cancel keeps the user signed in", async () => {
    const { calls } = open(<SignOutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.getByText("Are you sure you want to sign out?", { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument());
    expect(calls.filter(({ method }) => method === "POST")).toHaveLength(0);
  });

  it("signs out on confirmation", async () => {
    const { calls, client } = open(<SignOutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, sign out" }));

    await waitFor(() => expect(calls.some(({ url, method }) => url.endsWith("/logout") && method === "POST")).toBe(true));
    await waitFor(() => expect(client.getQueryData(ME_QUERY_KEY)).toBeNull());
  });
});

describe("notifications", () => {
  it("counts what is new, and clears the count once opened", async () => {
    open(<NotificationBell />);

    const bell = await screen.findByRole("button", { name: "Notifications, 2 new" });
    await userEvent.click(bell);

    expect(screen.getByRole("link", { name: /Rejected: Grade 7 – Honesty/ })).toHaveAttribute("href", "/schedule/sections/5");
    expect(screen.getByText(/Too many Math periods/)).toBeInTheDocument();
    // The open list hides the page behind it from screen readers, so look past that.
    expect(screen.getByRole("button", { name: "Notifications", hidden: true })).toBeInTheDocument();
  });

  it("says when there is nothing", async () => {
    open(<NotificationBell />, []);

    await userEvent.click(await screen.findByRole("button", { name: "Notifications" }));

    expect(screen.getByText(/You are all caught up/)).toBeInTheDocument();
  });

  it("counts only what came after the list was last opened", () => {
    expect(unreadCount(ITEMS, null)).toBe(2);
    expect(unreadCount(ITEMS, "2026-11-06T12:00:00+08:00")).toBe(1);
    expect(unreadCount(ITEMS, "2026-11-08T00:00:00+08:00")).toBe(0);
  });
});
