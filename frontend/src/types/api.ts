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
  /** Null until the Terms and Conditions are accepted. */
  terms_accepted_at?: string | null;
  /** Set after the Admin gave a temporary password. */
  must_change_password?: boolean;
  role: RoleName | null;
  personnel: { id: number; name: string } | null;
  /** Screen choices kept on the account, so they follow the user to any device. */
  preferences?: { color_coding: boolean };
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
  subject_id: number;
  teacher_id: number;
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
  /** Set for an activity such as Flag Ceremony: no teacher or room. */
  activity_id: number | null;
  /** Placed by auto-fill and not changed by hand since. */
  auto_filled?: boolean;
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
  activities: { id: number; name: string }[];
  /** How many sections "Apply to" reaches. */
  apply_counts: { grade: number; all: number };
  /** The latest auto-fill that still has classes here, so it can be undone. */
  last_auto_fill?: { id: number; created_at: string; entries: number } | null;
  rooms: RoomOption[];
  flags: ScheduleFlag[];
};

export type ScheduleConflict = {
  type: "teacher" | "room";
  days: number[];
  message: string;
  section: string;
  subject: string;
  time: string;
};

export type FreeTeacher = {
  id: number;
  name: string;
  /** Already teaches this subject in the term. */
  teaches_subject: boolean;
  hours_per_week: number;
};

export type ConflictDetails = {
  conflicts: ScheduleConflict[];
  suggestions: {
    rooms: RoomOption[];
    slots: { id: number; label: string }[];
    teachers: FreeTeacher[];
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
  co_adviser_id: number | null;
  co_adviser: string | null;
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
  co_adviser_id: number | null;
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
  /** The heading of the printed forms, under "Department of Education". */
  region?: string | null;
  division?: string | null;
  /** Shown on the landing page. */
  facebook_url: string | null;
  tagline: string | null;
  vision: string | null;
  mission: string | null;
  core_values: string | null;
  /** Sent by the server only: whether a campus photo was uploaded. */
  has_photo?: boolean;
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
  /** Each logo and where it is printed: at the top of the form or in its footer. */
  logo_items?: { src: string; placement: "header" | "footer" }[];
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

export type ManagedRoom = {
  id: number;
  room_number: string;
  room_name: string | null;
  /** Who looks after the room. */
  in_charge?: string | null;
  capacity: number | null;
  is_active: boolean;
  cannot_delete_reason: string | null;
};

export type ManagedBuilding = { id: number; name: string; rooms: ManagedRoom[] };

export type RoomInput = Omit<ManagedRoom, "id" | "cannot_delete_reason">;

export type PersonnelType = "teaching" | "non_teaching";

export type Qualification = {
  degree_level: string;
  degree: string;
  major: string | null;
  school: string | null;
  year_completed: number | null;
};

export type ManagedTeacher = {
  id: number;
  personnel_type: PersonnelType;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  display_name: string | null;
  printed_name: string;
  department_id: number | null;
  department: string | null;
  designation_id: number | null;
  designation: string | null;
  shift: Shift;
  max_subjects: number;
  max_hours_per_week: number;
  is_active: boolean;
  account_email: string | null;
  advisory: string | null;
  assigned: number;
  task_ids: number[];
  qualifications: Qualification[];
  cannot_delete_reason: string | null;
  /** False for a teacher of the other department only: the Admin keeps that record. */
  can_edit?: boolean;
};

export type TeacherInput = Pick<
  ManagedTeacher,
  | "personnel_type"
  | "first_name"
  | "middle_name"
  | "last_name"
  | "suffix"
  | "display_name"
  | "department_id"
  | "designation_id"
  | "shift"
  | "max_hours_per_week"
  | "is_active"
  | "qualifications"
  | "task_ids"
>;

export type NamedOption = { id: number; name: string };

export type PersonnelOptions = {
  departments: NamedOption[];
  designations: NamedOption[];
  tasks: NamedOption[];
};

export type PersonnelOptionType = "departments" | "designations" | "teaching-tasks";

export type SubjectType = "core" | "elective" | "other";

export type ManagedSubject = {
  id: number;
  grade_level_id: number;
  grade: number;
  level: SchoolLevel;
  track_id: number | null;
  track: string | null;
  term_no: number | null;
  code: string | null;
  name: string;
  subject_type: SubjectType;
  minutes_per_week: number;
  is_priority: boolean;
  is_active: boolean;
  locked_reason: string | null;
};

export type SubjectInput = Omit<
  ManagedSubject,
  "id" | "grade" | "level" | "track" | "locked_reason"
>;

export type SubjectOptions = {
  grade_levels: { id: number; grade: number; level: SchoolLevel }[];
  tracks: Track[];
  terms: { term_no: number; name: string }[];
};

export type LoadingRow = {
  subject_id: number;
  subject: string;
  code: string | null;
  minutes_per_week: number;
  is_priority: boolean;
  is_active: boolean;
  teacher_id: number | null;
  teacher: string | null;
  placed_entries: number;
  locked_reason: string | null;
};

export type LoadingTeacher = {
  id: number;
  name: string;
  shift: Shift;
  assigned: number;
  limit: number;
};

export type SectionLoading = {
  section: {
    id: number;
    label: string;
    level: SchoolLevel;
    shift: Shift;
    track: string | null;
    adviser: string | null;
  };
  rows: LoadingRow[];
  teachers: LoadingTeacher[];
};

export type MapRoom = {
  id: number;
  room_number: string;
  room_name: string | null;
  in_charge?: string | null;
  is_active: boolean;
  sections: SectionSummary[];
};

export type ScheduleMap = {
  buildings: { id: number; name: string; rooms: MapRoom[] }[];
  unassigned: SectionSummary[];
};

export type RoomSchedule = {
  room: {
    id: number;
    label: string;
    room_name: string | null;
    in_charge?: string | null;
    capacity: number | null;
    building: string;
  };
  sections: string[];
  entries: {
    id: number;
    day: number;
    start_time: string;
    end_time: string;
    minutes: number;
    status: ScheduleEntry["status"];
    subject: string | null;
    teacher: string | null;
    section_id: number;
    section: string;
    can_open: boolean;
  }[];
};

export type CopyLoadingResult = {
  copied: number;
  already_set: number;
  not_offered: number;
  teacher_unavailable: number;
};

export type ReportOptions = {
  sections: { id: number; label: string; level: SchoolLevel }[];
  teachers: { id: number; label: string }[];
  rooms: { id: number; label: string }[];
  grades: number[];
};

/** A Teacher Program or Room Schedule, for the preview on screen. */
export type ReportGrid = {
  title: string;
  term_label: string;
  heading: string;
  details: string[];
  days: { day: number; name: string }[];
  rows: {
    start_time: string;
    end_time: string;
    time: string;
    minutes: number;
    cells: Record<number, (string | null)[][]>;
  }[];
  totals: { per_day: Record<number, number>; week: number; week_duration: string };
  isDraft: boolean;
};

export type RoomUsage = {
  buildings: {
    name: string;
    rooms: {
      id: number;
      room_number: string;
      room_name: string | null;
      periods_per_week: number;
      sections: { label: string; periods_per_week: number }[];
    }[];
  }[];
};

export type DataResponse<T> = { data: T };

export type MessageResponse = { message: string };

export type MySchedule = Omit<ReportGrid, "title" | "isDraft"> & {
  /** Classes of this teacher that are not approved yet, so they stay hidden. */
  not_final_count: number;
};

export type MyProfile = {
  printed_name: string;
  email: string;
  department: string | null;
  designation: string | null;
  shift: "AM" | "PM" | "WHOLE_DAY";
  max_subjects: number;
  advisory: string | null;
  assigned: number;
  tasks: string[];
  qualifications: {
    degree_level: string | null;
    degree: string;
    major: string | null;
    school: string | null;
    year_completed: number | null;
  }[];
};

export type GuestTerm = { name: string; school_year: string };

export type GuestSectionList = {
  term: GuestTerm | null;
  sections: {
    id: number;
    name: string;
    grade: number;
    level: "JHS" | "SHS";
    track: string | null;
    adviser: string | null;
    co_adviser: string | null;
    is_ready: boolean;
  }[];
};

export type GuestWeek = {
  days: { day: number; name: string }[];
  /** The bell schedules. Each shows as its own table, as on the official form. */
  patterns: { name: string; days: number[] }[];
  rows: {
    start_time: string;
    end_time: string;
    time: string;
    minutes: number;
    /** The days whose bell schedule has this period. */
    days: number[];
    cells: Record<number, { subject: string | null; room: string | null } | null>;
    /** PHP sends an empty list when a row has no breaks. */
    breaks: Record<number, string> | [];
    wide_break: string | null;
  }[];
  totals: Record<number, string>;
};

export type GuestSection = { id: number; label: string; term: GuestTerm } & (
  | { state: "ready"; adviser: string | null; co_adviser: string | null; week: GuestWeek }
  | { state: "updating" | "not_ready" }
);

export type NextStepKey = "revise" | "no_bell_schedule" | "add_loading" | "plot" | "submit";

export type SchedulerDashboard = {
  has_scope: boolean;
  sections: number;
  pending_sections: number;
  approved_sections: number;
  flags: AdminDashboard["flags"];
  next_steps: { key: NextStepKey; sections: { id: number; label: string }[] }[];
  progress: AdminDashboard["progress"];
  overloaded_teachers: AdminDashboard["overloaded_teachers"];
  steps: SchedulerStep[];
};

/** The four steps of making a schedule, in order, with how far along each is. */
export type SchedulerStep =
  | { key: "subjects"; done: boolean; counts: { subjects: number; activities: number; sections: number } }
  | { key: "teachers"; done: boolean; counts: { teachers: number } }
  | { key: "loading"; done: boolean; counts: { loaded: number; needed: number; over_hours: number } }
  | { key: "plot"; done: boolean; counts: { sections: number; started: number; submitted: number } };

export type ImportResult = {
  copied: number;
  already_set: number;
  no_section: number;
  no_subject: number;
  not_offered: number;
  teacher_unavailable: number;
  /** Sections that got loading. */
  sections: number;
  missing: string[];
};

export type CopyScheduleResult = {
  sections_copied: number;
  sections_with_schedule: string[];
  sections_with_nothing: number;
  entries: number;
  filled: number;
  open_slots: number;
  left_open: number;
  not_fitting: number;
  loading_copied: number;
};

export type ValidationReportData = {
  summary: {
    sections: number;
    sections_with_issues: number;
    issues: number;
    urgent: number;
    not_acknowledged: number;
  };
  term_label: string;
  sections: {
    id: number;
    label: string;
    status: ScheduleStatus;
    status_label: string;
    issues: {
      message: string;
      severity: "red" | "amber";
      level: string;
      acknowledged: boolean;
    }[];
  }[];
};

export type TeacherLoadData = {
  term_label: string;
  summary: { teachers: number; overloaded: number; over_hours: number };
  teachers: {
    id: number;
    name: string;
    department: string | null;
    assigned: number;
    limit: number;
    is_overloaded: boolean;
    minutes: number;
    duration: string;
    classes: string[];
    /** From the teacher loading, plotted or not. */
    hours_per_week: number;
    max_hours: number;
    is_over_hours: boolean;
    loads: { section_id: number; section: string; subject: string; hours_per_week: number }[];
  }[];
};

/** Adviser Summary: each grade's sections with room, adviser and co-adviser. */
export type AdviserSummaryData = {
  term_label: string;
  summary: { sections: number; without_adviser: number };
  grades: {
    grade: number;
    title: string;
    sections: {
      number: number;
      id: number;
      name: string;
      room: string | null;
      adviser: string | null;
      co_adviser: string | null;
    }[];
  }[];
};

export type GradeTimetableData = {
  grade: number;
  title: string;
  term_label: string;
  isDraft: boolean;
  tables: {
    name: string;
    sections: { id: number; label: string }[];
    rows: {
      key: number;
      time: string;
      minutes: number;
      break: string | null;
      cells: Record<number, { subject: string; teacher: string | null; room: string | null; days: string | null }[]>;
    }[];
  }[];
};

export type AppNotification = {
  key: string;
  title: string;
  body: string;
  /** Where the user goes to deal with it. */
  link: string;
  at: string;
};

export type ActivityScope = "section" | "grade" | "all";

export type ActivityPlacement = {
  activity: string;
  time: string;
  sections: {
    id: number;
    label: string;
    days: number[];
    /** Why this section was left out, if it was. */
    skipped: string | null;
    /** Classes the activity takes the place of, such as "Filipino (Monday)". */
    unplaced: string[];
  }[];
  placed_sections: number;
  unplaced_classes: number;
};

export type Activity = { id: number; code: string | null; name: string; in_use: boolean };

export type AutoFillPlan = {
  /** Sent back with Confirm, so nothing is saved if the schedules changed since. */
  plan_hash: string;
  placed: number;
  unplaced_count: number;
  sections: { id: number; label: string; placed: number; minutes: number; unplaced: number }[];
  unplaced: { section: string; subject: string; teacher: string; minutes_left: number; reason: string }[];
  skipped: { section: string; reason: string }[];
  run_id?: number;
};

export type PublicSchool = {
  school_name: string;
  short_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook_url: string | null;
  tagline: string | null;
  vision: string | null;
  mission: string | null;
  core_values: string | null;
  has_photo: boolean;
};

export type ImportMissingKind = "sections" | "bell_schedules" | "subjects" | "teachers" | "rooms";

export type ScheduleImportResult = {
  /** The import template, or the school's own class program workbook ("..._CP" sheets). */
  source?: "template" | "class_program";
  sections_found?: string[];
  total: number;
  ok: number;
  errors: number;
  /** Subjects that get teacher loading from the file. */
  new_loadings: number;
  /** Whether what the file names but the system lacks was set up for this result. */
  set_up?: boolean;
  /** What the file names but the system does not have yet, with a few names each. */
  missing?: Record<ImportMissingKind, { count: number; names: string[] }>;
  rows: {
    row: number;
    section: string;
    day: string;
    time: string;
    subject: string;
    teacher: string;
    room: string;
    status: "ok" | "error";
    message: string | null;
  }[];
};

/** One teacher's classes in a term, for the teacher detail page. */
export type TeacherSchedule = {
  classes: {
    /** Null for a section of the other department, which is named only as "Junior/Senior High section". */
    section_id: number | null;
    section: string;
    subject: string | null;
    minutes_per_week: number;
    meetings: { day: number; start_time: string; end_time: string; minutes: number; room: string | null; status: ScheduleEntry["status"] }[];
  }[];
  minutes_per_week: number;
};
