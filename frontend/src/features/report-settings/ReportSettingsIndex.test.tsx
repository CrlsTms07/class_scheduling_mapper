import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import type { ReportSettings, Signatory, Term } from "@/types/api";
import ReportSettingsIndex from "./ReportSettingsIndex";

const TERM: Term = {
  id: 2,
  term_no: 1,
  name: "First Term",
  start_date: "2026-06-01",
  end_date: "2026-09-15",
  is_active: true,
  school_year: { id: 1, name: "2026-2027", term_count: 3, term_label: "Term" },
};

const SETTINGS: ReportSettings = {
  school: {
    school_name: "My School",
    school_id: null,
    address: "Somewhere",
    phone: null,
    email: null,
    website: null,
    facebook_url: null,
    tagline: null,
    vision: null,
    mission: null,
    core_values: null,
    has_photo: false,
  },
  logos: ["data:image/png;base64,AAAA", "data:image/png;base64,BBBB"],
  max_logos: 4,
  documents: [
    {
      report_type: "class_program",
      level: "JHS",
      title_format: "{level} GRADE {grade} – CLASS PROGRAM",
      doc_ref_code: "REF-1",
      revision_no: "00",
      effectivity_date: "2026-06-08",
      reference_note: "DO 12",
    },
  ],
};

const signatory = (id: number, label: string, overrides: Partial<Signatory> = {}): Signatory => ({
  id,
  report_type: "class_program",
  level: "JHS",
  label,
  name: `${label} Name`,
  position: "Head Teacher III",
  auto_source: null,
  sort_order: id,
  ...overrides,
});

const SIGNATORIES = [
  signatory(1, "Prepared by"),
  signatory(2, "Conforme", { name: null, auto_source: "section_adviser", position: "Class Adviser" }),
  signatory(3, "Noted by", { level: "SHS" }),
];

type Call = { url: string; method: string; body: unknown };

function openPage(settings: ReportSettings = SETTINGS, reply: unknown = { data: { terms: 2 } }, status = 200) {
  const calls: Call[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("csrf-cookie")) return new Response(null, { status: 204 });
      if (init?.method && init.method !== "GET") {
        calls.push({
          url,
          method: init.method,
          body: typeof init.body === "string" ? JSON.parse(init.body) : init.body,
        });
        return new Response(JSON.stringify(reply), { status });
      }
      const data = url.includes("signatories") ? SIGNATORIES : url.includes("report-settings") ? settings : [TERM];
      return new Response(JSON.stringify({ data }), { status: 200 });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["terms"], [TERM]);
  client.setQueryData(["report-settings"], settings);
  client.setQueryData(["terms", 2, "signatories"], SIGNATORIES);

  render(
    <QueryClientProvider client={client}>
      <SelectedTermProvider>
        <ReportSettingsIndex />
      </SelectedTermProvider>
    </QueryClientProvider>,
  );

  return calls;
}

const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const openTab = (name: string) => userEvent.click(screen.getByRole("tab", { name }));
const documentForm = (name: string) => within(screen.getByRole("form", { name }));

describe("school profile", () => {
  it("shows the saved details and logos", () => {
    openPage();

    expect(screen.getByLabelText("School name")).toHaveValue("My School");
    expect(screen.getByAltText("Logo 1")).toBeInTheDocument();
    expect(screen.getByAltText("Logo 2")).toBeInTheDocument();
  });

  it("saves the details, sending blank fields as nothing", async () => {
    const calls = openPage();

    await userEvent.type(screen.getByLabelText("Telephone (optional)"), "123");
    await click("Save school details");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/school-profile$/);
    expect(calls[0].body).toEqual({
      school_name: "My School",
      school_id: null,
      address: "Somewhere",
      phone: "123",
      email: null,
      website: null,
      region: null,
      division: null,
      facebook_url: null,
      tagline: null,
      vision: null,
      mission: null,
      core_values: null,
    });
    expect(await screen.findByText("The school details were saved.")).toBeInTheDocument();
  });

  it("needs a school name", async () => {
    const calls = openPage();

    await userEvent.clear(screen.getByLabelText("School name"));
    await click("Save school details");

    expect(await screen.findByText("Enter the school name")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("uploads a logo as a file", async () => {
    const calls = openPage();
    const file = new File(["png"], "logo.png", { type: "image/png" });

    await userEvent.upload(screen.getByLabelText("Logo file"), file);

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/school-profile\/logos$/);
    expect((calls[0].body as FormData).get("logo")).toBeInstanceOf(File);
  });

  it("removes a logo by its place", async () => {
    const calls = openPage();

    await click("Remove logo 2");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/school-profile\/logos\/1$/);
  });

  it("stops at the maximum number of logos", () => {
    openPage({ ...SETTINGS, logos: ["a", "b", "c", "d"] });

    expect(screen.getByRole("button", { name: "Add a logo" })).toBeDisabled();
  });

  it("asks for the school details before any logo on a new server", () => {
    openPage({ ...SETTINGS, school: null, logos: [] });

    expect(screen.getByRole("button", { name: "Add a logo" })).toBeDisabled();
    expect(screen.getByText("Save the school details first.")).toBeInTheDocument();
  });
});

describe("documents", () => {
  it("shows every form, with saved values or a starting title", async () => {
    openPage();

    await openTab("Documents");

    expect(documentForm("Class Program (JHS)").getByLabelText("Doc. Ref. Code")).toHaveValue("REF-1");
    expect(documentForm("Teacher Program").getByLabelText("Title")).toHaveValue("TEACHER PROGRAM");
    expect(documentForm("Room Schedule").getByLabelText("Title")).toHaveValue("ROOM SCHEDULE");
  });

  it("saves one form", async () => {
    const calls = openPage();

    await openTab("Documents");
    await userEvent.type(documentForm("Teacher Program").getByLabelText("Revision"), "01");
    await click("Save Teacher Program");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({
      report_type: "teacher_program",
      level: null,
      title_format: "TEACHER PROGRAM",
      doc_ref_code: null,
      revision_no: "01",
      effectivity_date: null,
      reference_note: null,
    });
    expect(await screen.findByText("Teacher Program was saved.")).toBeInTheDocument();
  });
});

describe("signatories", () => {
  it("shows one form of the selected term, in order", async () => {
    openPage();

    await openTab("Signatories");

    expect(screen.getByText("First Term, SY 2026-2027")).toBeInTheDocument();
    expect(screen.getByText("Prepared by Name")).toBeInTheDocument();
    expect(screen.getByText("The section's class adviser")).toBeInTheDocument();
    expect(screen.queryByText("Noted by Name")).not.toBeInTheDocument();
  });

  it("switches to another form", async () => {
    openPage();

    await openTab("Signatories");
    await userEvent.selectOptions(screen.getByLabelText("Department"), "SHS");

    expect(screen.getByText("Noted by Name")).toBeInTheDocument();
    expect(screen.queryByText("Prepared by Name")).not.toBeInTheDocument();
  });

  it("adds a signatory with a typed name to the shown form", async () => {
    const calls = openPage();

    await openTab("Signatories");
    await click("Add signatory");
    await userEvent.type(screen.getByLabelText("Signs as"), "Approved by");
    await userEvent.type(screen.getByLabelText("Name to print"), "Ana Reyes");
    await userEvent.type(screen.getByLabelText("Position (optional)"), "PSDS");
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/terms\/2\/signatories$/);
    expect(calls[0].body).toEqual({
      report_type: "class_program",
      level: "JHS",
      label: "Approved by",
      name: "Ana Reyes",
      position: "PSDS",
      auto_source: null,
    });
  });

  it("needs a name unless it is automatic", async () => {
    const calls = openPage();

    await openTab("Signatories");
    await click("Add signatory");
    await userEvent.type(screen.getByLabelText("Signs as"), "Conforme");
    await click("Save");

    expect(await screen.findByText("Enter the name to print")).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await userEvent.click(screen.getByText("Fill the name automatically"));
    expect(screen.queryByLabelText("Name to print")).not.toBeInTheDocument();
    await click("Save");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toMatchObject({ name: null, auto_source: "section_adviser" });
  });

  it("offers no automatic name where none fits", async () => {
    openPage();

    await openTab("Signatories");
    await userEvent.selectOptions(screen.getByLabelText("Document"), "room_schedule");
    await click("Add signatory");

    expect(screen.queryByText("Fill the name automatically")).not.toBeInTheDocument();
  });

  it("moves a signatory, but not past the ends", async () => {
    const calls = openPage();

    await openTab("Signatories");

    expect(screen.getByRole("button", { name: "Move Prepared by up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Conforme down" })).toBeDisabled();

    await click("Move Conforme up");

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toMatch(/\/signatories\/2\/move$/);
    expect(calls[0].body).toEqual({ direction: "up" });
  });

  it("removes a signatory after asking", async () => {
    const calls = openPage();

    await openTab("Signatories");
    await click("Edit Prepared by");
    await click("Remove this signatory");
    expect(calls).toHaveLength(0);
    await click("Yes, remove");

    await waitFor(() => expect(calls[0]?.method).toBe("DELETE"));
    expect(calls[0].url).toMatch(/\/signatories\/1$/);
  });

  it("warns before using these signatories for the whole year", async () => {
    const calls = openPage();

    await openTab("Signatories");
    await click("Use First Term's signatories for the whole year");

    expect(screen.getByText(/What they have now will be replaced/)).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await click("Yes, use in all");

    await waitFor(() => expect(calls[0]?.url).toMatch(/\/terms\/2\/signatories\/copy$/));
    expect(await screen.findByText(/The rest of this school year now uses/)).toBeInTheDocument();
  });
});
