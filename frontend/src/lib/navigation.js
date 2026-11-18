// @ts-check
/**
 * The menu (design audit, Must fix #2, approved Nov 17, 2026). It is short enough to fit a
 * 1366×768 laptop without scrolling, and the Setup group follows the dashboard's steps in order.
 */

/** @typedef {import("@/state/session.js").RoleName} RoleName */

const ADMIN = /** @type {RoleName[]} */ (["super_admin"]);
const SCHEDULERS = /** @type {RoleName[]} */ (["glc", "master_teacher"]);
const STAFF = /** @type {RoleName[]} */ ([...ADMIN, ...SCHEDULERS]);
const TEACHER = /** @type {RoleName[]} */ (["teacher"]);
const EVERYONE = /** @type {RoleName[]} */ ([...STAFF, ...TEACHER]);

export const ROLES = { ADMIN, SCHEDULERS, STAFF, TEACHER, EVERYONE };

/** @type {Record<RoleName, string>} */
export const ROLE_LABELS = {
  super_admin: "Admin",
  glc: "Chairperson",
  master_teacher: "Master Teacher",
  teacher: "Teacher",
};

/** The short role on the badge in the header; the full name is its tooltip and screen-reader text. */
/** @type {Record<RoleName, string>} */
export const ROLE_BADGES = {
  super_admin: "Admin",
  glc: "GLC",
  master_teacher: "MT",
  teacher: "Teacher",
};

/**
 * @typedef {{ name: string, path: string, icon: import("@/components/icons.js").IconName, roles: RoleName[], ownRecord?: boolean }} NavItem
 * @typedef {{ label: string, items: NavItem[] }} NavGroup
 */

/** @type {NavGroup[]} */
const NAVIGATION = [
  {
    label: "Main",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: "dashboard", roles: EVERYONE },
      { name: "Schedule", path: "/schedule", icon: "calendar-check", roles: STAFF },
      { name: "Approvals", path: "/approvals", icon: "circle-check", roles: ADMIN },
      { name: "Reports", path: "/reports", icon: "folder", roles: STAFF },
    ],
  },
  {
    label: "Setup",
    items: [
      { name: "1 · Rooms & Buildings", path: "/buildings", icon: "building", roles: STAFF },
      { name: "2 · Time Slots", path: "/time-slots", icon: "clock", roles: STAFF },
      { name: "3 · Subjects", path: "/subjects", icon: "book", roles: STAFF },
      { name: "4 · Sections", path: "/sections", icon: "team", roles: STAFF },
      { name: "5 · Teachers", path: "/teachers", icon: "users", roles: STAFF },
      { name: "6 · Teacher Loading", path: "/teacher-loading", icon: "clipboard", roles: STAFF },
    ],
  },
  {
    label: "Admin",
    items: [
      { name: "Users & Roles", path: "/users", icon: "users", roles: ADMIN },
      { name: "School Years", path: "/school-years", icon: "calendar", roles: ADMIN },
      { name: "Report Settings", path: "/report-settings", icon: "file-cog", roles: ADMIN },
    ],
  },
  {
    label: "My records",
    items: [
      { name: "My Schedule", path: "/my-schedule", icon: "calendar-check", roles: [...TEACHER, ...SCHEDULERS], ownRecord: true },
      { name: "My Profile", path: "/my-profile", icon: "user", roles: [...TEACHER, ...SCHEDULERS], ownRecord: true },
    ],
  },
];

/**
 * The menu a role can see. A Chairperson or Master Teacher sees My Schedule only with a
 * personnel record. Groups with nothing to show are left out.
 *
 * @param {RoleName | null} role
 * @param {boolean} [hasPersonnel]
 * @returns {NavGroup[]}
 */
export function navigationFor(role, hasPersonnel = false) {
  /** @param {NavItem} item */
  const canSee = (item) => role !== null && item.roles.includes(role) && (!item.ownRecord || role === "teacher" || hasPersonnel);

  return NAVIGATION.map((group) => ({ ...group, items: group.items.filter(canSee) })).filter((group) => group.items.length > 0);
}
