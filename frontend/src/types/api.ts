// Shapes of the data returned by the Laravel API.

export type RoleName = "super_admin" | "glc" | "master_teacher" | "teacher";

export type AccountStatus = "pending" | "active" | "inactive";

export type GradeLevel = {
  id: number;
  grade: number;
  level: "JHS" | "SHS";
};

export type User = {
  id: number;
  email: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  status: AccountStatus;
  role: RoleName | null;
  grade_levels: GradeLevel[];
};

export type ActiveTerm = {
  id: number;
  term_no: number;
  name: string;
  start_date: string;
  end_date: string;
  school_year: {
    id: number;
    name: string;
    term_count: number;
    term_label: string;
  };
};

export type DataResponse<T> = { data: T };

export type MessageResponse = { message: string };
