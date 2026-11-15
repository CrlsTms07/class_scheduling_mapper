import { describe, expect, it } from "vitest";
import type { Signatory } from "@/types/api";
import {
  emptyToNull,
  ProfileSchema,
  signatoriesOf,
  SignatorySchema,
  toDocumentForm,
  toSignatoryInput,
} from "./reportSettings";

const signatory = (overrides: Partial<Signatory> = {}): Signatory => ({
  id: 1,
  report_type: "class_program",
  level: "JHS",
  label: "Prepared by",
  name: "Name",
  position: null,
  auto_source: null,
  sort_order: 1,
  ...overrides,
});

describe("emptyToNull", () => {
  it("saves blank fields as nothing and trims the rest", () => {
    expect(emptyToNull("   ")).toBeNull();
    expect(emptyToNull(" Head ")).toBe("Head");
  });
});

describe("signatoriesOf", () => {
  it("keeps only one form, in signing order", () => {
    const found = signatoriesOf(
      [
        signatory({ id: 1, sort_order: 2 }),
        signatory({ id: 2, sort_order: 1 }),
        signatory({ id: 3, level: "SHS" }),
        signatory({ id: 4, report_type: null, level: null }),
      ],
      "class_program",
      "JHS",
    );

    expect(found.map(({ id }) => id)).toEqual([2, 1]);
  });

  it("finds the signatories for all documents and departments", () => {
    const found = signatoriesOf([signatory({ report_type: null, level: null })], null, null);

    expect(found).toHaveLength(1);
  });
});

describe("toSignatoryInput", () => {
  const values = { label: "Conforme", useAutomaticName: true, name: "Typed", position: " " };

  it("uses the adviser on a Class Program and keeps no typed name", () => {
    expect(toSignatoryInput(values, "class_program", "JHS")).toEqual({
      report_type: "class_program",
      level: "JHS",
      label: "Conforme",
      name: null,
      position: null,
      auto_source: "section_adviser",
    });
  });

  it("uses the teacher on a Teacher Program", () => {
    expect(toSignatoryInput(values, "teacher_program", null).auto_source).toBe("teacher");
  });

  it("falls back to the typed name where no automatic name fits", () => {
    const input = toSignatoryInput(values, "room_schedule", null);

    expect(input.auto_source).toBeNull();
    expect(input.name).toBe("Typed");
  });
});

describe("toDocumentForm", () => {
  it("starts from the default title when nothing is saved", () => {
    expect(toDocumentForm(undefined, "ROOM SCHEDULE")).toEqual({
      title_format: "ROOM SCHEDULE",
      doc_ref_code: "",
      revision_no: "",
      effectivity_date: "",
      reference_note: "",
    });
  });
});

describe("forms", () => {
  it("needs a typed name unless the name is automatic", () => {
    const base = { label: "Approved by", position: "" };

    expect(SignatorySchema.safeParse({ ...base, useAutomaticName: false, name: "" }).success).toBe(false);
    expect(SignatorySchema.safeParse({ ...base, useAutomaticName: true, name: "" }).success).toBe(true);
  });

  it("allows a blank email but not a wrong one", () => {
    const profile = {
      school_name: "X", school_id: "", address: "", phone: "", website: "", region: "", division: "",
      facebook_url: "", tagline: "", vision: "", mission: "", core_values: "",
    };

    expect(ProfileSchema.safeParse({ ...profile, email: "" }).success).toBe(true);
    expect(ProfileSchema.safeParse({ ...profile, email: "nope" }).success).toBe(false);
  });
});
