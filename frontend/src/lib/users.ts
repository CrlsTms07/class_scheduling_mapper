import type { RoleName, User } from "@/types/api";
import { ROLE_LABELS } from "./navigation";

export const STATUS_LABELS: Record<User["status"], string> = {
  pending: "Waiting for activation",
  active: "Active",
  inactive: "Deactivated",
};

export const STATUS_COLORS: Record<User["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  active: "bg-emerald-100 text-emerald-900",
  inactive: "bg-neutral-200 text-neutral-800",
};

export function fullName(user: Pick<User, "first_name" | "last_name">): string {
  return `${user.first_name} ${user.last_name}`;
}

/** "Grade 7, 8", or nothing for roles without a scope. */
export function scopeLabel(user: Pick<User, "grade_levels">): string {
  return user.grade_levels.length > 0
    ? `Grade ${user.grade_levels.map(({ grade }) => grade).join(", ")}`
    : "";
}

/** What the main button of an account says. */
export function actionLabel(status: User["status"]): string {
  return { pending: "Activate", active: "Change access", inactive: "Reactivate" }[status];
}

export function filterUsers(
  users: User[],
  search: string,
  status: string,
  role: string,
): User[] {
  const words = search.trim().toLowerCase();

  return users.filter(
    (user) =>
      (status === "" || user.status === status) &&
      (role === "" || user.role === role) &&
      `${fullName(user)} ${user.email} ${user.role ? ROLE_LABELS[user.role as RoleName] : ""}`
        .toLowerCase()
        .includes(words),
  );
}
