import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import FlagsPanel from "./FlagsPanel";

describe("flags panel", () => {
  it("says how to fix each flag, with a link when the fix is on another page", () => {
    render(
      <MemoryRouter>
        <FlagsPanel
          flags={[
            { key: "minutes:1:180", type: "minutes_under", severity: "amber", blocking: false, acknowledged: false, message: "Science needs 40 more minutes a week (180 of 220 scheduled)." },
            { key: "no_room", type: "no_room", severity: "red", blocking: true, acknowledged: false, message: "4 classes have no room yet." },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Science needs 40 more minutes a week/)).toBeInTheDocument();
    expect(screen.getByText(/Place this subject in one more free period/)).toBeInTheDocument();
    expect(screen.getByText(/Give the section its home room/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Sections", hidden: true })).toHaveAttribute("href", "/sections");
  });
});
