import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ValidationReportData } from "@/types/api";
import ValidationReport from "./ValidationReport";

const REPORT: ValidationReportData = {
  summary: { sections: 3, sections_with_issues: 1, issues: 2, urgent: 1, not_acknowledged: 1 },
  term_label: "First Term, School Year 2026-2027",
  sections: [
    {
      id: 5,
      label: "Grade 7 – Honesty",
      status: "draft",
      status_label: "Draft",
      issues: [
        { message: "2 open slots are still unfilled.", severity: "red", level: "Must fix", acknowledged: false },
        { message: "This section has no adviser.", severity: "amber", level: "To check", acknowledged: true },
      ],
    },
  ],
};

let requested: string[];

function open(data: ValidationReportData = REPORT) {
  requested = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      return url.endsWith(".pdf") || url.endsWith(".xlsx")
        ? new Response(new Blob(["file"]))
        : new Response(JSON.stringify({ data }));
    }),
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ValidationReport termId={2} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:file");
  URL.revokeObjectURL = vi.fn();
});

describe("Conflict and Validation Report", () => {
  it("shows the summary, and the issues of each section", async () => {
    open();

    expect(await screen.findByText("2 open slots are still unfilled.")).toBeInTheDocument();
    expect(screen.getByText("Must fix")).toBeInTheDocument();
    expect(screen.getByText("(acknowledged)")).toBeInTheDocument();
    expect(screen.getByText(/in 1 of 3 sections/)).toHaveTextContent("1 urgent, 1 not yet acknowledged.");
  });

  it("links each section to where it can be fixed", async () => {
    open();

    expect(await screen.findByRole("link", { name: "Grade 7 – Honesty" })).toHaveAttribute("href", "/schedule/sections/5");
  });

  it("says when everything is clear", async () => {
    open({
      ...REPORT,
      sections: [],
      summary: { sections: 3, sections_with_issues: 0, issues: 0, urgent: 0, not_acknowledged: 0 },
    });

    expect(await screen.findByText("Nothing to check. Every section is clear.")).toBeInTheDocument();
  });

  it("downloads as PDF and XLSX", async () => {
    open();

    await userEvent.click(screen.getByRole("button", { name: "Download Conflict and Validation Report as PDF" }));
    await waitFor(() => expect(requested.some((url) => url.endsWith("/terms/2/reports/validation.pdf"))).toBe(true));

    await userEvent.click(screen.getByRole("button", { name: "Download Conflict and Validation Report as XLSX" }));
    await waitFor(() => expect(requested.some((url) => url.endsWith("/terms/2/reports/validation.xlsx"))).toBe(true));
  });
});
