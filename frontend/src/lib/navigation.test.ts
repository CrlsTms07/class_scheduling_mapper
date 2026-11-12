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

  it("gives the Admin the whole schedule process too (team decision, Nov 10, 2026)", () => {
    expect(menuPaths("super_admin")).toEqual(expect.arrayContaining(["/dashboard", "/schedule", "/teacher-loading"]));
  });

  it("groups the menu as Main, Manage, Approvals, Reports and Settings for the Admin", () => {
    expect(navigationFor("super_admin").map((group) => group.label)).toEqual(["Main", "Manage", "Approvals", "Reports", "Settings"]);
  });

  it.each<RoleName>(["glc", "master_teacher"])(
    "gives %s scheduling pages but no Admin pages",
    (role) => {
      const paths = menuPaths(role);

      expect(paths).toEqual(
        expect.arrayContaining(["/dashboard", "/schedule", "/teacher-loading", "/subjects", "/sections", "/buildings", "/time-slots", "/reports"]),
      );
      expect(paths).not.toContain("/approvals");
      expect(paths).not.toContain("/users");
      expect(paths).not.toContain("/school-years");
    },
  );

  it("gives a teacher a dashboard, and their own schedule and profile", () => {
    expect(menuPaths("teacher")).toEqual(["/dashboard", "/my-schedule", "/my-profile"]);
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
  it("sends everyone with a role to the dashboard", () => {
    expect(homePathFor("teacher")).toBe("/dashboard");
    expect(homePathFor("super_admin")).toBe("/dashboard");
    expect(homePathFor("glc")).toBe("/dashboard");
  });
});
