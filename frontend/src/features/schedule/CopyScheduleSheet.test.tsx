import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CopyScheduleResult, Term } from "@/types/api";
import CopyScheduleSheet from "./CopyScheduleSheet";

const term = (id: number, name: string) =>
  ({ id, name, school_year: { id: 1, name: "2026-2027" } }) as Term;

const SECTIONS = [
  { id: 5, name: "Honesty", grade: 7, level: "JHS", adviser: null, status: "not_started" },
  { id: 6, name: "Faith", grade: 8, level: "JHS", adviser: null, status: "draft" },
];

const RESULT: CopyScheduleResult = {
  sections_copied: 1,
  sections_with_schedule: ["Grade 8 – Faith"],
  sections_with_nothing: 0,
  entries: 10,
  filled: 8,
  open_slots: 2,
  left_open: 0,
  not_fitting: 0,
  loading_copied: 3,
};

function open(result: CopyScheduleResult = RESULT) {
  const bodies: Record<string, unknown>[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
      if (init.method === "POST") {
        bodies.push(JSON.parse(init.body as string));
        return new Response(JSON.stringify({ data: result }));
      }
      return new Response(JSON.stringify({ data: SECTIONS }));
    }),
  );

  const onClose = vi.fn();

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CopyScheduleSheet term={term(2, "Second Term")} otherTerms={[term(1, "First Term"), term(3, "Third Term")]} onClose={onClose} />
    </QueryClientProvider>,
  );

  return { bodies, onClose };
}

describe("copying a schedule", () => {
  it("reviews first, without copying, then copies on confirmation", async () => {
    const { bodies } = open();

    expect(screen.queryByRole("button", { name: "Confirm copy" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(await screen.findByText("This is what will happen:")).toBeInTheDocument();
    expect(screen.getByText(/1 section, 10 periods: 8 with subject and teacher, 2 open slots/)).toBeInTheDocument();
    expect(screen.getByText(/Skipped, because .*Grade 8 – Faith/)).toBeInTheDocument();
    expect(bodies).toEqual([
      { from_term_id: 1, section_id: null, grade: null, fill_subjects: true, preview: true },
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Confirm copy" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Copied. Open each section to finish it.");
    expect(bodies[1]).toMatchObject({ preview: false });
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("sends the chosen term and scope", async () => {
    const { bodies } = open();

    await userEvent.selectOptions(screen.getByLabelText("Copy from"), "3");
    await screen.findByRole("option", { name: "All of Grade 7" });
    await userEvent.selectOptions(screen.getByLabelText("Which sections"), "All of Grade 7");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ from_term_id: 3, section_id: null, grade: 7, fill_subjects: false, preview: true });
  });

  it("can target one section", async () => {
    const { bodies } = open();

    await screen.findByRole("option", { name: "Grade 7 – Honesty" });
    await userEvent.selectOptions(screen.getByLabelText("Which sections"), "Grade 7 – Honesty");
    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => expect(bodies[0]).toMatchObject({ section_id: 5, grade: null }));
  });

  it("makes the user review again after a change", async () => {
    open();

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await screen.findByRole("button", { name: "Confirm copy" });

    await userEvent.selectOptions(screen.getByLabelText("Copy from"), "3");

    expect(screen.queryByRole("button", { name: "Confirm copy" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
  });

  it("offers no confirmation when there is nothing to copy", async () => {
    open({ ...RESULT, sections_copied: 0, entries: 0, filled: 0, open_slots: 0, loading_copied: 0 });

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(await screen.findByText("There is nothing to copy.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm copy" })).not.toBeInTheDocument();
  });
});
