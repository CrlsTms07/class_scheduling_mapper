import { describe, expect, it } from "vitest";
import type { User } from "@/types/api";
import { actionLabel, filterUsers, fullName, scopeLabel } from "./users";

const user = (overrides: Partial<User> = {}): User => ({
  id: 1,
  email: "ana.reyes@deped.gov.ph",
  first_name: "Ana",
  middle_name: null,
  last_name: "Reyes",
  suffix: null,
  status: "active",
  role: "glc",
  personnel: null,
  grade_levels: [],
  ...overrides,
});

describe("fullName and scopeLabel", () => {
  it("writes the name", () => {
    expect(fullName(user())).toBe("Ana Reyes");
  });

  it("lists grade levels, or nothing when there are none", () => {
    expect(
      scopeLabel(
        user({
          grade_levels: [
            { id: 1, grade: 7, level: "JHS" },
            { id: 2, grade: 8, level: "JHS" },
          ],
        }),
      ),
    ).toBe("Grade 7, 8");
    expect(scopeLabel(user())).toBe("");
  });
});

describe("actionLabel", () => {
  it("fits what can be done with each status", () => {
    expect(actionLabel("pending")).toBe("Activate");
    expect(actionLabel("active")).toBe("Change access");
    expect(actionLabel("inactive")).toBe("Reactivate");
  });
});

describe("filterUsers", () => {
  const users = [
    user(),
    user({ id: 2, first_name: "Ben", last_name: "Cruz", email: "ben@deped.gov.ph", role: null, status: "pending" }),
    user({ id: 3, first_name: "Cris", last_name: "Lim", email: "cris@deped.gov.ph", role: "teacher", status: "inactive" }),
  ];
  const ids = (found: User[]) => found.map(({ id }) => id);

  it("searches names, emails and role names", () => {
    expect(ids(filterUsers(users, "REYES", "", ""))).toEqual([1]);
    expect(ids(filterUsers(users, "ben@", "", ""))).toEqual([2]);
    expect(ids(filterUsers(users, "chairperson", "", ""))).toEqual([1]);
  });

  it("filters by status and role", () => {
    expect(ids(filterUsers(users, "", "pending", ""))).toEqual([2]);
    expect(ids(filterUsers(users, "", "", "teacher"))).toEqual([3]);
    expect(ids(filterUsers(users, "", "active", "teacher"))).toEqual([]);
  });

  it("shows everyone with no filter", () => {
    expect(filterUsers(users, "", "", "")).toHaveLength(3);
  });
});
