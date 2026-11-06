import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  Building,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  CirclePile,
  CircleUserRound,
  ClipboardList,
  Clock,
  FileCog,
  FolderUser,
  LayoutDashboard,
  UserGroup,
  UserRound,
} from "lucide-react";
import type { RoleName } from "@/types/api";

const ADMIN: RoleName[] = ["super_admin"];
const SCHEDULERS: RoleName[] = ["glc", "master_teacher"];
const STAFF: RoleName[] = [...ADMIN, ...SCHEDULERS];
const TEACHER: RoleName[] = ["teacher"];

export const ROLES = { ADMIN, SCHEDULERS, STAFF, TEACHER };

export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin: "Admin",
  glc: "Chairperson",
  master_teacher: "Master Teacher",
  teacher: "Teacher",
};

type NavItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  roles: RoleName[];
};

type NavGroup = { label: string; items: NavItem[] };

const NAVIGATION: NavGroup[] = [
  {
    label: "Main",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: STAFF },
      { name: "Approvals", path: "/approvals", icon: CircleCheck, roles: ADMIN },
      { name: "Schedule", path: "/schedule", icon: CalendarCheck, roles: STAFF },
      { name: "My Schedule", path: "/my-schedule", icon: CalendarCheck, roles: TEACHER },
      { name: "My Profile", path: "/my-profile", icon: UserRound, roles: TEACHER },
      { name: "Teacher Loading", path: "/teacher-loading", icon: ClipboardList, roles: SCHEDULERS },
      { name: "Teachers", path: "/teachers", icon: CircleUserRound, roles: STAFF },
      { name: "Sections", path: "/sections", icon: Blocks, roles: ADMIN },
      { name: "Reports", path: "/reports", icon: FolderUser, roles: STAFF },
    ],
  },
  {
    label: "Manage",
    items: [
      { name: "School Years", path: "/school-years", icon: CalendarDays, roles: ADMIN },
      { name: "Time Slots", path: "/time-slots", icon: Clock, roles: ADMIN },
      { name: "Subjects", path: "/subjects", icon: CirclePile, roles: STAFF },
      { name: "Building", path: "/buildings", icon: Building, roles: STAFF },
      { name: "Users", path: "/users", icon: UserGroup, roles: ADMIN },
      { name: "Report Settings", path: "/report-settings", icon: FileCog, roles: ADMIN },
    ],
  },
];

/** The menu a role can see. Groups with nothing to show are left out. */
export function navigationFor(role: RoleName | null): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => role !== null && item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}

/** Where a role lands after signing in. */
export function homePathFor(role: RoleName | null): string {
  return role === "teacher" ? "/my-schedule" : "/dashboard";
}
