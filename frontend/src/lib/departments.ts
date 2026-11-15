import type { SchoolLevel } from "@/types/api";

/** Junior High, Senior High, or shared by both (no department). */
export type Department = SchoolLevel | null;

export const departmentLabel = (department: Department | undefined, sharedWord = "Shared") =>
  department === "JHS" ? "Junior High" : department === "SHS" ? "Senior High" : sharedWord;

/** Badge colors: each department its own, shared in neutral. */
export const DEPARTMENT_BADGE: Record<"JHS" | "SHS" | "shared", string> = {
  JHS: "bg-sky-100 text-sky-900",
  SHS: "bg-violet-100 text-violet-900",
  shared: "bg-neutral-200 text-neutral-800",
};

export const departmentBadge = (department: Department | undefined) => DEPARTMENT_BADGE[department ?? "shared"];
