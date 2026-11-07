import { describe, expect, it } from "vitest";
import { homePathFor, navigationFor } from "./navigation";
import type { RoleName } from "@/types/api";

const menuPaths = (role: RoleName | null) =>
  navigationFor(role).flatMap((group) => group.items.map((item) => item.path));

describe("navigationFor", () => {
  it("gives the Admin approvals and setup pages", () => {
    expect(menuPaths("super_admin")).toEqual(
      expect.arrayContaining([
        "/approvals",
        "/sections",
        "/school-years",
        "/time-slots",
        "/users",
        "/report-settings",
      ]),
    );
  });

  it("does not give the Admin teacher loading, because the Admin does not plot", () => {
    expect(menuPaths("super_admin")).not.toContain("/teacher-loading");
  });

  it.each<RoleName>(["glc", "master_teacher"])(
    "gives %s scheduling pages but no Admin pages",
    (role) => {
      const paths = menuPaths(role);

      expect(paths).toEqual(
        expect.arrayContaining(["/schedule", "/teacher-loading", "/subjects"]),
      );
      expect(paths).not.toContain("/approvals");
      expect(paths).not.toContain("/users");
      expect(paths).not.toContain("/sections");
    },
  );

  it("gives a teacher only their own schedule and profile", () => {
    expect(menuPaths("teacher")).toEqual(["/my-schedule", "/my-profile"]);
  });

  it.each<RoleName>(["glc", "master_teacher"])(
    "gives %s their own schedule only when they have a personnel record",
    (role) => {
      const pathsWith = (hasPersonnel: boolean) =>
        navigationFor(role, hasPersonnel).flatMap((group) => group.items.map((item) => item.path));

      expect(pathsWith(false)).not.toContain("/my-schedule");
      expect(pathsWith(true)).toEqual(expect.arrayContaining(["/my-schedule", "/my-profile"]));
    },
  );

  it("never gives the Admin a schedule of their own", () => {
    expect(
      navigationFor("super_admin", true).flatMap((group) => group.items.map((item) => item.path)),
    ).not.toContain("/my-schedule");
  });

  it("hides a group with nothing to show", () => {
    expect(navigationFor("teacher").map((group) => group.label)).toEqual(["Main"]);
  });

  it("shows nothing to a user without a role", () => {
    expect(navigationFor(null)).toEqual([]);
  });
});

describe("homePathFor", () => {
  it("sends teachers to their schedule and everyone else to the dashboard", () => {
    expect(homePathFor("teacher")).toBe("/my-schedule");
    expect(homePathFor("super_admin")).toBe("/dashboard");
    expect(homePathFor("glc")).toBe("/dashboard");
  });
});
