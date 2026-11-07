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
  personnel: { id: number; name: string } | null;
  /** Sent on the Users page only. */
  cannot_delete_reason?: string | null;
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

export type SchoolYearTerm = {
  id: number;
  term_no: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  cannot_remove_reason: string | null;
};

export type SchoolYear = {
  id: number;
  name: string;
  term_count: number;
  term_label: string;
  start_date: string;
  end_date: string;
  cannot_delete_reason: string | null;
  counts: {
    subjects: number;
    day_patterns: number;
    sections: number;
    signatories: number;
  };
  terms: SchoolYearTerm[];
};

export type SchoolYearInput = {
  name: string;
  start_date: string;
  end_date: string;
  term_label: string;
  terms: { name: string; start_date: string; end_date: string }[];
};

export type CopyOption = "subjects" | "time_slots" | "signatories" | "section_names";

export type StartSchoolYearInput = SchoolYearInput & {
  copy_from_id: number | null;
  copy: Record<CopyOption, boolean>;
};

export type CopyResult = {
  subjects?: number;
  subjects_skipped?: number;
  day_patterns?: number;
  time_slots?: number;
  signatories?: number;
  sections?: number;
};

export type SchoolLevel = "JHS" | "SHS";
export type Shift = "AM" | "PM" | "WHOLE_DAY";

/** A period or break on the Time Slots page. */
export type ManagedSlot = TimeSlot & { locked_reason: string | null };

/** A bell schedule on the Time Slots page. */
export type ManagedPattern = {
  id: number;
  level: SchoolLevel;
  shift: Shift;
  name: string;
  days: number[];
  locked_reason: string | null;
  slots: ManagedSlot[];
};

export type PatternInput = {
  level: SchoolLevel;
  shift: Shift;
  name: string;
  days: number[];
};

export type SlotInput = {
  is_break: boolean;
  label: string;
  start_time: string;
  end_time: string;
};

/** A section on the Admin's Sections page. */
export type ManagedSection = {
  id: number;
  name: string;
  label: string;
  grade_level_id: number;
  grade: number;
  level: SchoolLevel;
  shift: Shift;
  track_id: number | null;
  track: string | null;
  adviser_id: number | null;
  adviser: string | null;
  home_room_id: number | null;
  home_room: string | null;
  class_size: number | null;
  locked_reason: string | null;
};

export type SectionInput = {
  grade_level_id: number;
  name: string;
  shift: Shift;
  track_id: number | null;
  adviser_id: number | null;
  home_room_id: number | null;
  class_size: number | null;
};

export type Track = { id: number; name: string };

export type SectionOptions = {
  grade_levels: { id: number; grade: number; level: SchoolLevel }[];
  tracks: Track[];
  teachers: {
    id: number;
    name: string;
    advises_section_id: number | null;
    advises: string | null;
  }[];
  rooms: { id: number; label: string }[];
};

export type ReportType = "class_program" | "teacher_program" | "room_schedule";

export type SchoolProfile = {
  school_name: string;
  school_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

export type DocumentSetting = {
  report_type: ReportType;
  level: SchoolLevel | null;
  title_format: string;
  doc_ref_code: string | null;
  revision_no: string | null;
  effectivity_date: string | null;
  reference_note: string | null;
};

export type ReportSettings = {
  school: SchoolProfile | null;
  /** Embedded images, in printing order. */
  logos: string[];
  max_logos: number;
  documents: DocumentSetting[];
};

export type AutoSource = "section_adviser" | "teacher";

export type Signatory = {
  id: number;
  report_type: ReportType | null;
  level: SchoolLevel | null;
  label: string;
  name: string | null;
  position: string | null;
  auto_source: AutoSource | null;
  sort_order: number;
};

export type SignatoryInput = Omit<Signatory, "id" | "sort_order">;

export type ChecklistKey =
  | "calendar"
  | "school_profile"
  | "time_slots"
  | "sections"
  | "signatories"
  | "schedulers";

export type AdminDashboard = {
  pending_sections: number;
  pending_accounts: number;
  flags: { total: number; urgent: number; sections: number };
  progress: {
    grade: number;
    level: SchoolLevel;
    sections: number;
    not_started: number;
    draft: number;
    pending: number;
    approved: number;
    rejected: number;
  }[];
  overloaded_teachers: { id: number; name: string; assigned: number; limit: number }[];
  checklist: { key: ChecklistKey; title: string; done: boolean; detail: string }[];
};

export type DataResponse<T> = { data: T };

export type MessageResponse = { message: string };
