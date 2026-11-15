import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ME_QUERY_KEY } from "@/api/queryClient";
import type { RoleName, User } from "@/types/api";
import ScheduleGuidePage from "./ScheduleGuidePage";

function openAs(role: RoleName) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(ME_QUERY_KEY, { id: 1, first_name: "Ana", last_name: "Reyes", role, grade_levels: [] } as unknown as User);

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ScheduleGuidePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("how to make a schedule", () => {
  it("goes from the school year to the printed forms, in numbered steps", () => {
    openAs("glc");

    expect(screen.getByRole("heading", { name: "How to make a schedule" })).toBeInTheDocument();
    const parts = ["Before the school year", "Get ready", "Make the schedule", "Approve", "Print and share"];
    parts.forEach((part) => expect(screen.getByRole("region", { name: part })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /Step 1:\s*Start the school year/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print this guide" })).toBeInTheDocument();
  });

  it("marks the Chairperson's own steps with a link, and only names the Admin's", () => {
    openAs("glc");

    const ready = within(screen.getByRole("region", { name: "Get ready" }));
    expect(ready.getByRole("link", { name: /Go to Time Slots/ })).toHaveAttribute("href", "/time-slots");
    expect(ready.getAllByText("You").length).toBeGreaterThan(0);

    const before = within(screen.getByRole("region", { name: "Before the school year" }));
    expect(before.queryByRole("link")).not.toBeInTheDocument();
    expect(before.getByText("Done on the Users page.")).toBeInTheDocument();
  });

  it("gives the Admin a link at every step", () => {
    openAs("super_admin");

    expect(screen.getByRole("link", { name: /Go to Approvals/ })).toHaveAttribute("href", "/approvals");
    expect(screen.getByRole("link", { name: /Go to School Years/ })).toHaveAttribute("href", "/school-years");
  });
});
