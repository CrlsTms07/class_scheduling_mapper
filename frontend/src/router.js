// @ts-check
/**
 * Which page shows for which address, and who may open it. Pages load only when first opened,
 * so the app starts fast. Links work like normal links (open in a new tab, copy the address).
 */
import { ROLES } from "@/lib/navigation.js";
import { session } from "@/state/session.js";

/**
 * @typedef {object} PageContext
 * @property {Record<string, string>} params  parts of the address, like { sectionId: "5" }
 * @property {URLSearchParams} query
 * @property {(path: string) => void} navigate
 *
 * @typedef {(container: HTMLElement, context: PageContext) => (void | (() => void)) | Promise<void | (() => void)>} RenderPage
 *
 * @typedef {object} Route
 * @property {string} path
 * @property {() => Promise<{ render: RenderPage }>} page
 * @property {"app" | "auth" | "open" | "gate" | "public"} layout  app: signed-in pages; auth: sign-in pages (visitors);
 *   open: sign-in frame for anyone (reset password); gate: a step a signed-in account owes first; public: anyone
 * @property {import("@/state/session.js").RoleName[]} [roles]
 * @property {string} [title]
 */

/** @type {Route[]} */
export const ROUTES = [
  { path: "/", layout: "public", title: "Home", page: () => import("@/features/guest/pages.js").then((module) => ({ render: module.renderHome })) },
  { path: "/guest", layout: "public", title: "Find your class schedule", page: () => import("@/features/guest/pages.js").then((module) => ({ render: module.renderGuestIndex })) },
  { path: "/guest/sections/:sectionId", layout: "public", title: "Class schedule", page: () => import("@/features/guest/pages.js").then((module) => ({ render: module.renderGuestSection })) },
  { path: "/login", layout: "auth", title: "Sign in", page: () => import("@/features/auth/login-page.js") },
  { path: "/signup", layout: "auth", title: "Sign up", page: () => import("@/features/auth/account-pages.js").then((module) => ({ render: module.renderSignUp })) },
  { path: "/forgot-password", layout: "auth", title: "Forgot your password", page: () => import("@/features/auth/account-pages.js").then((module) => ({ render: module.renderForgot })) },
  { path: "/reset-password", layout: "open", title: "Choose a new password", page: () => import("@/features/auth/account-pages.js").then((module) => ({ render: module.renderReset })) },
  { path: "/accept-terms", layout: "gate", title: "Before you continue", page: () => import("@/features/auth/account-pages.js").then((module) => ({ render: module.renderAcceptTerms })) },
  { path: "/change-password", layout: "gate", title: "Choose your own password", page: () => import("@/features/auth/account-pages.js").then((module) => ({ render: module.renderChangePassword })) },
  { path: "/dashboard", layout: "app", roles: ROLES.EVERYONE, title: "Dashboard", page: () => import("@/features/dashboard/page.js") },
  { path: "/schedule", layout: "app", roles: ROLES.STAFF, title: "Schedule", page: () => import("@/features/schedule/list/page.js") },
  { path: "/schedule/rooms/:roomId", layout: "app", roles: ROLES.STAFF, title: "Room schedule", page: () => import("@/features/schedule/places.js").then((module) => ({ render: module.renderRoom })) },
  { path: "/schedule/buildings/:buildingId", layout: "app", roles: ROLES.STAFF, title: "Building", page: () => import("@/features/schedule/places.js").then((module) => ({ render: module.renderBuilding })) },
  { path: "/schedule/sections/:sectionId", layout: "app", roles: ROLES.STAFF, title: "Section schedule", page: () => import("@/features/schedule/plotter/page.js") },
  { path: "/approvals", layout: "app", roles: ROLES.ADMIN, title: "Approvals", page: () => import("@/features/approvals/page.js") },
  { path: "/reports", layout: "app", roles: ROLES.STAFF, title: "Reports", page: () => import("@/features/reports/page.js") },
  { path: "/buildings", layout: "app", roles: ROLES.STAFF, title: "Rooms & Buildings", page: () => import("@/features/setup/buildings.js") },
  { path: "/time-slots", layout: "app", roles: ROLES.STAFF, title: "Class Hours", page: () => import("@/features/setup/time-slots.js") },
  { path: "/subjects", layout: "app", roles: ROLES.STAFF, title: "Subjects", page: () => import("@/features/setup/subjects.js") },
  { path: "/sections", layout: "app", roles: ROLES.STAFF, title: "Sections", page: () => import("@/features/setup/sections.js") },
  { path: "/teachers/:teacherId", layout: "app", roles: ROLES.STAFF, title: "Teacher", page: () => import("@/features/setup/teachers.js").then((module) => ({ render: module.renderDetail })) },
  { path: "/teachers", layout: "app", roles: ROLES.STAFF, title: "Teachers", page: () => import("@/features/setup/teachers.js") },
  { path: "/teacher-loading", layout: "app", roles: ROLES.STAFF, title: "Teacher Loading", page: () => import("@/features/teacher-loading/page.js") },
  { path: "/users", layout: "app", roles: ROLES.ADMIN, title: "Users & Roles", page: () => import("@/features/admin/users.js") },
  { path: "/school-years", layout: "app", roles: ROLES.ADMIN, title: "School Years", page: () => import("@/features/admin/school-years.js") },
  { path: "/report-settings", layout: "app", roles: ROLES.ADMIN, title: "Report Settings", page: () => import("@/features/admin/report-settings.js") },
  { path: "/my-schedule", layout: "app", roles: [...ROLES.TEACHER, ...ROLES.SCHEDULERS], title: "My Schedule", page: () => import("@/features/my-records/pages.js").then((module) => ({ render: module.renderMySchedule })) },
  { path: "/my-profile", layout: "app", roles: [...ROLES.TEACHER, ...ROLES.SCHEDULERS], title: "My Profile", page: () => import("@/features/my-records/pages.js").then((module) => ({ render: module.renderMyProfile })) },
];

/**
 * Finds the route of an address and the parts it holds.
 * @param {string} pathname
 * @returns {{ route: Route, params: Record<string, string> } | null}
 */
export function matchRoute(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/";

  for (const route of ROUTES) {
    const names = [];
    const pattern = route.path.replace(/:([a-zA-Z]+)/g, (_, name) => {
      names.push(name);
      return "([^/]+)";
    });
    const match = clean.match(new RegExp(`^${pattern}$`));
    if (match) {
      return { route, params: Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(match[index + 1])])) };
    }
  }
  return null;
}

/**
 * Where someone may go: visitors to sign in, signed-in users away from sign-in pages,
 * and anyone without the role back to the dashboard.
 *
 * @param {Route | null} route
 * @returns {string | null} the address to go to instead, or null when the page may open
 */
export function redirectFor(route) {
  const user = session.user;
  if (!route) return user ? "/dashboard" : "/";
  if (route.layout === "auth") return user ? "/dashboard" : null;
  if (route.layout === "open" || route.layout === "public") return null;
  if (!user) return "/login";
  // Steps an account owes before anything else: the Terms and Notice, then its own password.
  const owesTerms = user.terms_accepted_at === null || user.privacy_accepted_at === null;
  if (route.layout === "gate") return owesTerms && route.path !== "/accept-terms" ? "/accept-terms" : !owesTerms && !user.must_change_password ? "/dashboard" : null;
  if (owesTerms) return "/accept-terms";
  if (user.must_change_password) return "/change-password";
  if (route.roles && (!user?.role || !route.roles.includes(user.role))) return "/dashboard";
  return null;
}
