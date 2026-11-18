// @ts-check
import { describe, expect, it } from "vitest";
import { APPROVAL_TABS, entriesFor, sectionsFor } from "./approvals.js";

const section = (id, status, pending, approved) => /** @type {any} */ ({ id, label: `S${id}`, status, pending_count: pending, approved_count: approved, flags: [] });
const SECTIONS = [section(1, "pending", 40, 0), section(2, "approved", 0, 35), section(3, "draft", 0, 0), section(4, "rejected", 0, 0)];

describe("approvals", () => {
  it("approves and rejects only what is pending, and reopens only what is approved", () => {
    expect(sectionsFor(SECTIONS, "approve").map(({ id }) => id)).toEqual([1]);
    expect(sectionsFor(SECTIONS, "reject").map(({ id }) => id)).toEqual([1]);
    expect(sectionsFor(SECTIONS, "reopen").map(({ id }) => id)).toEqual([2]);
  });

  it("counts the classes an action reaches", () => {
    expect(entriesFor(SECTIONS, "approve")).toBe(40);
    expect(entriesFor(SECTIONS, "reopen")).toBe(35);
  });

  it("puts drafts and rejected schedules under Not submitted", () => {
    const notSubmitted = APPROVAL_TABS.find(({ key }) => key === "not_submitted");
    expect(SECTIONS.filter((item) => notSubmitted?.includes(item)).map(({ id }) => id)).toEqual([3, 4]);
  });
});
