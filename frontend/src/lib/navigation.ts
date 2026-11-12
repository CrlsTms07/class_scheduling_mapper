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
const TEACHING: RoleName[] = [...TEACHER, ...SCHEDULERS];
const EVERYONE: RoleName[] = [...STAFF, ...TEACHER];

export const ROLES = { ADMIN, SCHEDULERS, STAFF, TEACHER, TEACHING, EVERYONE };

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
  /** A Chairperson or Master Teacher sees it only if their account has a personnel record. */
  isOwnRecord?: boolean;
};

type NavGroup = { label: string; items: NavItem[] };

/**
 * The menu, grouped the way the school works (team decision, Nov 10, 2026):
 * Main is where schedules are made, Manage holds the records they are made from.
 */
const NAVIGATION: NavGroup[] = [
  {
    label: "Main",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: EVERYONE },
      { name: "Schedule", path: "/schedule", icon: CalendarCheck, roles: STAFF },
      { name: "Teacher Loading", path: "/teacher-loading", icon: ClipboardList, roles: STAFF },
      { name: "My Schedule", path: "/my-schedule", icon: CalendarCheck, roles: TEACHER },
      { name: "My Profile", path: "/my-profile", icon: UserRound, roles: TEACHER },
    ],
  },
  {
    label: "Manage",
    items: [
      { name: "Teachers", path: "/teachers", icon: CircleUserRound, roles: STAFF },
      { name: "Sections", path: "/sections", icon: Blocks, roles: STAFF },
      { name: "Subjects", path: "/subjects", icon: CirclePile, roles: STAFF },
      { name: "Rooms & Buildings", path: "/buildings", icon: Building, roles: STAFF },
      { name: "Time Slots", path: "/time-slots", icon: Clock, roles: STAFF },
      { name: "Users & Roles", path: "/users", icon: UserGroup, roles: ADMIN },
    ],
  },
  {
    label: "Approvals",
    items: [{ name: "Approvals", path: "/approvals", icon: CircleCheck, roles: ADMIN }],
  },
  {
    label: "Reports",
    items: [{ name: "Reports", path: "/reports", icon: FolderUser, roles: STAFF }],
  },
  {
    label: "My Records",
    items: [
      { name: "My Schedule", path: "/my-schedule", icon: CalendarCheck, roles: SCHEDULERS, isOwnRecord: true },
      { name: "My Profile", path: "/my-profile", icon: UserRound, roles: SCHEDULERS, isOwnRecord: true },
    ],
  },
  {
    label: "Settings",
    items: [
      { name: "School Years", path: "/school-years", icon: CalendarDays, roles: ADMIN },
      { name: "Report Settings", path: "/report-settings", icon: FileCog, roles: ADMIN },
    ],
  },
];

/** The menu a role can see. Groups with nothing to show are left out. */
export function navigationFor(role: RoleName | null, hasPersonnel = false): NavGroup[] {
  const canSee = (item: NavItem) =>
    role !== null &&
    item.roles.includes(role) &&
    (!item.isOwnRecord || role === "teacher" || hasPersonnel);

  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter(canSee),
  })).filter((group) => group.items.length > 0);
}

/** Where a role lands after signing in. */
export function homePathFor(role: RoleName | null): string {
  return role === null ? "/" : "/dashboard";
}
