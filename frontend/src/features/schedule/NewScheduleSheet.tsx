import React from "react";
import { CalendarPlus, ClipboardList, Copy, FileUp, Plus, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { STATUS_LABELS } from "@/lib/schedule";
import type { SectionSummary } from "@/types/api";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type NewScheduleSheetProp = {
  sections: SectionSummary[];
  /** Left out when there is no other term to copy from. */
  onCopy?: () => void;
  onImport: () => void;
  onClose: () => void;
};

type Way = { key: string; icon: React.ReactNode; title: string; detail: string; onChoose: () => void };

/**
 * New schedule: choose the section, then how to start it. Every way ends in the same
 * timetable, where each class can still be changed.
 */
const NewScheduleSheet = ({ sections, onCopy, onImport, onClose }: NewScheduleSheetProp) => {
  const navigate = useNavigate();
  // Sections not started yet come first, since those are the ones to make.
  const ordered = [...sections].sort(
    (a, b) => Number(a.status !== "not_started") - Number(b.status !== "not_started") || a.grade - b.grade || a.name.localeCompare(b.name),
  );
  const [sectionId, setSectionId] = React.useState(ordered[0]?.id);

  const ways: Way[] = [
    {
      key: "timetable",
      icon: <CalendarPlus className="size-5" />,
      title: "Build it on a timetable",
      detail: "Open the section's week. Tap a period, then choose the subject, teacher and room. Minutes add up by themselves.",
      onChoose: () => navigate(`/schedule/sections/${sectionId}`),
    },
    {
      key: "autofill",
      icon: <Sparkles className="size-5" />,
      title: "Let the system fill it",
      detail: "Auto-fill places each subject in free periods without conflicts. You review it first, then move or change any class.",
      onChoose: () => navigate(`/schedule/sections/${sectionId}?autofill=1`),
    },
    ...(onCopy
      ? [{
          key: "copy",
          icon: <Copy className="size-5" />,
          title: "Copy another term's schedule",
          detail: "Start from a schedule already made this school year, then edit only what changed.",
          onChoose: onCopy,
        }]
      : []),
    {
      key: "import",
      icon: <FileUp className="size-5" />,
      title: "Import from a file",
      detail: "Fill in the template from your Excel schedule, upload it, and review every row first.",
      onChoose: onImport,
    },
  ];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-branding">New schedule</SheetTitle>
          <SheetDescription>Choose the section, then how you want to start.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          {ordered.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-dashed p-4 text-sm text-neutral-700">
              <p>There is no section to schedule yet. Add the sections of your grade levels first.</p>
              <Link
                to="/sections?add=1"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#790D16] px-4 font-medium text-white hover:bg-[#790D16]/90"
              >
                <Plus className="size-4" />
                Add a section
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label htmlFor="new-schedule-section" className="text-sm font-medium text-neutral-900">
                  1. Section
                </label>
                <NativeSelect
                  id="new-schedule-section"
                  className="w-full [&_select]:h-11"
                  value={sectionId}
                  onChange={(event) => setSectionId(Number(event.target.value))}
                >
                  {ordered.map((section) => (
                    <NativeSelectOption key={section.id} value={section.id}>
                      Grade {section.grade} – {section.name} ({STATUS_LABELS[section.status]})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Link to="/sections?add=1" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-branding underline-offset-2 hover:underline">
                  <Plus className="size-4" />
                  The section is not here? Add a section
                </Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">2. How do you want to start?</p>
                <ul className="space-y-2">
                  {ways.map((way) => (
                    <li key={way.key}>
                      <button
                        type="button"
                        onClick={way.onChoose}
                        className="flex w-full min-h-11 items-start gap-3 rounded-xl border bg-white p-3 text-left transition hover:border-[#790D16]/50 hover:bg-[#790D16]/5 focus-visible:outline-2 focus-visible:outline-[#790D16]"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#790D16]/10 text-[#790D16]">{way.icon}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-neutral-900">{way.title}</span>
                          <span className="block text-xs text-neutral-700">{way.detail}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="flex gap-2 rounded-md bg-neutral-50 p-3 text-xs text-neutral-700">
                <ClipboardList className="size-4 shrink-0 text-[#790D16]" />
                <span>
                  Each subject needs its teacher first. If the list of subjects is empty on the timetable, set them in{" "}
                  <Link to="/teacher-loading" className="font-medium text-branding underline-offset-2 hover:underline">
                    Teacher Loading
                  </Link>
                  .
                </span>
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NewScheduleSheet;
