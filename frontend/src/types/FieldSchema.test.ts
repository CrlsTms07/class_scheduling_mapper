import { describe, expect, it } from "vitest";
import { ResetPasswordSchema, SigninSchema, SignUpSchema } from "./FieldSchema";

const signUp = {
  first_name: "Juan",
  middle_name: "",
  last_name: "Dela Cruz",
  suffix: "",
  email: "juan@deped.gov.ph",
  password: "Password123!",
  confirmPassword: "Password123!",
};

describe("SigninSchema", () => {
  it("accepts an official DepEd email, in any letter case", () => {
    const result = SigninSchema.safeParse({
      email: "Juan@DepEd.gov.ph",
      password: "x",
    });
    expect(result.success).toBe(true);
  });

  it.each(["juan@gmail.com", "juan@deped.gov.ph.com", "not-an-email", ""])(
    "rejects %s",
    (email) => {
      expect(SigninSchema.safeParse({ email, password: "x" }).success).toBe(false);
    },
  );
});

describe("SignUpSchema", () => {
  it("accepts valid details with optional fields empty", () => {
    expect(SignUpSchema.safeParse(signUp).success).toBe(true);
  });

  it("requires a DepEd email", () => {
    const result = SignUpSchema.safeParse({ ...signUp, email: "juan@gmail.com" });
    expect(result.success).toBe(false);
  });

  it.each(["Ab1!", "Password!!", "Password123", "password123!"])(
    "rejects the weak password %s",
    (password) => {
      const result = SignUpSchema.safeParse({
        ...signUp,
        password,
        confirmPassword: password,
      });
      expect(result.success).toBe(false);
    },
  );

  it("rejects passwords that do not match", () => {
    const result = SignUpSchema.safeParse({
      ...signUp,
      confirmPassword: "Different123!",
    });
    expect(result.success).toBe(false);
  });
});

describe("ResetPasswordSchema", () => {
  it("only needs the new password, because the email comes from the link", () => {
    const result = ResetPasswordSchema.safeParse({
      password: "Password123!",
      confirmPassword: "Password123!",
    });
    expect(result.success).toBe(true);
  });
});
