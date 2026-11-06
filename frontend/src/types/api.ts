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

export type Term = {
  id: number;
  term_no: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  school_year: {
    id: number;
    name: string;
    term_count: number;
    term_label: string;
  };
};

export type ScheduleStatus =
  | "not_started"
  | "draft"
  | "pending"
  | "approved"
  | "rejected";

export type SectionSummary = {
  id: number;
  name: string;
  grade: number;
  level: "JHS" | "SHS";
  adviser: string | null;
  status: ScheduleStatus;
};

export type TimeSlot = {
  id: number;
  period_no: number | null;
  label: string | null;
  start_time: string;
  end_time: string;
  minutes: number;
  is_break: boolean;
};

export type DayPattern = {
  id: number;
  name: string;
  days: number[];
  slots: TimeSlot[];
};

export type Loading = {
  id: number;
  subject: string;
  is_priority: boolean;
  required_minutes: number;
  scheduled_minutes: number;
  teacher: string;
};

export type ScheduleEntry = {
  id: number;
  day: number;
  start_time: string;
  end_time: string;
  status: "draft" | "pending" | "approved" | "rejected";
  section_subject_id: number | null;
  subject: string | null;
  teacher: string | null;
  room_id: number | null;
  room: string | null;
};

export type ScheduleFlag = {
  key: string;
  type: string;
  severity: "red" | "amber";
  message: string;
  /** Must be fixed: it cannot be acknowledged. */
  blocking: boolean;
  acknowledged: boolean;
  section_subject_id?: number;
};

export type RoomOption = { id: number; label: string };

export type Plotter = {
  section: {
    id: number;
    name: string;
    label: string;
    level: "JHS" | "SHS";
    grade: number;
    shift: string;
    adviser: string | null;
    home_room_id: number | null;
  };
  status: ScheduleStatus;
  can_plot: boolean;
  can_edit: boolean;
  last_review: {
    action: ReviewAction;
    remarks: string | null;
    reviewed_by: string;
    created_at: string;
  } | null;
  patterns: DayPattern[];
  loading: Loading[];
  entries: ScheduleEntry[];
  rooms: RoomOption[];
  flags: ScheduleFlag[];
};

export type ScheduleConflict = {
  type: "teacher" | "room";
  days: number[];
  message: string;
};

export type ConflictDetails = {
  conflicts: ScheduleConflict[];
  suggestions: {
    rooms: RoomOption[];
    slots: { id: number; label: string }[];
  };
};

export type ReviewAction = "approve" | "reject" | "reopen";

export type ReviewInput = {
  scope: "section" | "grade_level" | "JHS" | "SHS" | "all";
  scope_ref_id?: number;
  action: ReviewAction;
  remarks?: string;
};

export type ApprovalSection = {
  id: number;
  name: string;
  label: string;
  grade_level_id: number;
  grade: number;
  level: "JHS" | "SHS";
  adviser: string | null;
  status: ScheduleStatus;
  pending_count: number;
  approved_count: number;
  flags: ScheduleFlag[];
};

export type AccessOptions = {
  grade_levels: GradeLevel[];
  teachers: { id: number; first_name: string; last_name: string }[];
};

export type DataResponse<T> = { data: T };

export type MessageResponse = { message: string };
