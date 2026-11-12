import React from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronRight, Info, LayoutGrid, Mail, MoreHorizontal, Pencil, SearchIcon, Trash2, UserRound } from "lucide-react";
import { useTeacherSchedule } from "@/api/scheduleBuilder";
import { useTeachers } from "@/api/teachers";
import { useSelectedTerm } from "@/context/selectedTerm";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DAY_NAMES, formatTime, WEEK_DAYS } from "@/lib/schedule";
import { SHIFT_LABELS } from "@/lib/timeSlots";
import type { TeacherSchedule } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Chip, ChipRow, Crumbs, Minutes, SectionHeading, TermTabs } from "@/components/global-component/ScheduleUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import TeacherDeleteDialog from "./TeacherDeleteDialog";
import TeacherSheet from "./TeacherSheet";

type TeacherClass = TeacherSchedule["classes"][number];

const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10} hrs`;

/** "Section detail": the days, times and rooms of one class of the teacher. */
const ClassDetailSheet = ({ item, onClose }: { item: TeacherClass; onClose: () => void }) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={isPhonePortrait ? "bottom" : "right"} className="max-h-dvh overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Section detail</SheetTitle>
          <SheetDescription>The classes of this section with the teacher.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-[#790D16]/10 text-branding">
              <LayoutGrid className="size-5" />
            </span>
            <div>
              <p className="text-lg font-semibold text-teal-700">{item.section}</p>
              {item.subject && <Chip>{item.subject}</Chip>}
            </div>
          </div>
          <ul className="space-y-4">
            {WEEK_DAYS.map((day) =>
              item.meetings
                .filter((meeting) => meeting.day === day)
                .map((meeting) => (
                  <li key={`${day}-${meeting.start_time}`} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-neutral-900">{DAY_NAMES[day]}</p>
                      <p className="text-sm text-neutral-700">
                        {formatTime(meeting.start_time)} – {formatTime(meeting.end_time)}
                      </p>
                      <p className="text-sm text-neutral-600">{meeting.room ?? "No room"}</p>
                    </div>
                    <Minutes minutes={meeting.minutes} />
                  </li>
                )),
            )}
          </ul>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

/** A teacher: who they are, what they handle, and their sections day by day in the selected term. */
const TeacherDetailPage = () => {
  const teacherId = Number(useParams().teacherId);
  const navigate = useNavigate();
  const { term } = useSelectedTerm();
  const { data: teachers, isPending } = useTeachers(term?.id);
  const { data: schedule, isError: isScheduleError } = useTeacherSchedule(term?.id, teacherId);
  const [search, setSearch] = React.useState("");
  const [opened, setOpened] = React.useState<TeacherClass | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const teacher = teachers?.find(({ id }) => id === teacherId);
  const crumbs = [{ label: "Home", to: "/dashboard" }, { label: "Teachers", to: "/teachers" }, { label: teacher?.printed_name ?? "Teacher" }];

  if (!term || isPending) return <p className="p-6 text-sm text-neutral-600">Loading...</p>;
  if (!teacher) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Crumbs items={crumbs} />
        <FormAlert>This teacher could not be found.</FormAlert>
      </div>
    );
  }

  const canEdit = teacher.can_edit !== false;
  const classes = schedule?.classes ?? [];
  const query = search.trim().toLowerCase();
  const shown = classes.filter((item) => `${item.section} ${item.subject ?? ""}`.toLowerCase().includes(query));
  const subjects = [...new Set(classes.map(({ subject }) => subject).filter((subject): subject is string => !!subject))];
  const info: [string, React.ReactNode][] = [
    ["Advisory", teacher.advisory ?? "None"],
    ["Department", teacher.department ?? "None yet"],
    ["Shift", SHIFT_LABELS[teacher.shift]],
    ["Load", `${teacher.assigned} of ${teacher.max_subjects} subjects${schedule ? `, ${hours(schedule.minutes_per_week)} a week` : ""}`],
  ];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Crumbs items={crumbs} />

      <section aria-label="Teacher" className="space-y-4 rounded-2xl border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#790D16]/10 text-branding">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-teal-700">{teacher.printed_name}</h1>
                {teacher.designation && <Badge className="bg-[#790D16] text-white">{teacher.designation}</Badge>}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-neutral-700">
                <Mail className="size-4" aria-hidden />
                {teacher.account_email ?? "No login account"}
              </p>
            </div>
          </div>
          <div className="relative flex flex-col items-end gap-2">
            <Badge className={teacher.is_active ? "bg-emerald-700 text-white" : "bg-neutral-200 text-neutral-800"}>{teacher.is_active ? "Active" : "Inactive"}</Badge>
            {canEdit && (
              <>
                <Button type="button" variant="outline" size="icon" className="size-11" aria-label="More actions" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                  <MoreHorizontal />
                </Button>
                {isMenuOpen && (
                  <div role="menu" className="absolute top-full right-0 z-20 mt-1 w-40 rounded-lg border bg-background p-1 shadow-lg">
                    <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-neutral-100" onClick={() => { setIsMenuOpen(false); setIsEditing(true); }}>
                      <Pencil className="size-4" />
                      Edit
                    </button>
                    <button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm text-destructive hover:bg-red-50" onClick={() => { setIsMenuOpen(false); setIsDeleting(true); }}>
                      <Trash2 className="size-4" />
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {info.map(([label, value]) => (
            <div key={label} className="space-y-1 lg:border-l lg:pl-3 lg:first:border-l-0 lg:first:pl-0">
              <dt className="text-sm text-neutral-600">{label}</dt>
              <dd>
                <span className="inline-flex min-h-7 items-center rounded-md bg-neutral-100 px-2 text-xs font-medium text-neutral-800">{value}</span>
              </dd>
            </div>
          ))}
        </dl>
        <ChipRow label="Subjects handled" chips={subjects.map((subject) => <Chip key={subject}>{subject}</Chip>)} />
      </section>

      <TermTabs />

      <SectionHeading title="Sections & Daily Schedule" term={term}>
        The sections this teacher handles, and the day, time and room of each class.
      </SectionHeading>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-sm text-neutral-700">
          <Info className="size-4" aria-hidden />
          <span className="font-semibold text-neutral-900">{classes.length}</span>
          {classes.length === 1 ? "class" : "classes"}
        </p>
        <InputGroup className="h-11 sm:w-64">
          <InputGroupInput aria-label="Search classes" className="h-11" placeholder="Search..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <InputGroupAddon align="inline-start">
            <SearchIcon className="text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {isScheduleError && <FormAlert>The classes could not be loaded.</FormAlert>}
      {schedule && classes.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-neutral-700">No classes yet in {term.name}.</p>
      )}
      {classes.length > 0 && shown.length === 0 && <p className="text-sm text-neutral-600">Nothing matches your search.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((item) => {
          const days = [...new Set(item.meetings.map(({ day }) => day))].sort();

          return (
            <article key={`${item.section}-${item.subject}`} className="space-y-3 rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#790D16]/10 text-branding">
                    <LayoutGrid className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900">{item.section}</p>
                    <p className="text-sm text-neutral-700">{item.subject ?? "Class"}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`Details of ${item.section}${item.subject ? `, ${item.subject}` : ""}`} onClick={() => setOpened(item)}>
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {days.map((day) => (
                  <Chip key={day}>{DAY_NAMES[day]}</Chip>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {opened && <ClassDetailSheet item={opened} onClose={() => setOpened(null)} />}
      {isEditing && <TeacherSheet term={term} teacher={teacher} onClose={() => setIsEditing(false)} />}
      {isDeleting && (
        <TeacherDeleteDialog teacher={teacher} onClose={() => setIsDeleting(false)} onDeleted={() => navigate("/teachers")} />
      )}
    </div>
  );
};

export default TeacherDetailPage;
