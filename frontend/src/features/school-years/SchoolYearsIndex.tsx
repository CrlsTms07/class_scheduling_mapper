import React from "react";
import { CalendarDays, Plus, Settings2 } from "lucide-react";
import { useActivateTerm, useSchoolYears } from "@/api/calendar";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import { formatDate } from "@/lib/schoolYear";
import type { SchoolYear, SchoolYearTerm } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import CalendarSettingsSheet from "./CalendarSettingsSheet";
import StartYearWizard from "./StartYearWizard";

const HOW_IT_WORKS = [
  "Start a new school year: set its dates and terms, and copy last year's setup.",
  "Finish the setup: time slots, sections, then teacher loading and schedules.",
  "Set the active term when classes begin. Teachers and guests see that term.",
];

type ActivateTermSheetProp = {
  term: SchoolYearTerm;
  yearName: string;
  currentName?: string;
  onClose: () => void;
};

const ActivateTermSheet = ({ term, yearName, currentName, onClose }: ActivateTermSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const activate = useActivateTerm();

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={isPhonePortrait ? "bottom" : "right"} className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-branding">Set {term.name} as active?</SheetTitle>
          <SheetDescription>School year {yearName}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4 text-sm text-neutral-800">
          {activate.isError && <FormAlert>{apiErrorMessage(activate.error)}</FormAlert>}
          <p>
            Teachers and guests will see the schedules of this term.
            {currentName && ` ${currentName} will stop being the active term.`} Past schedules are
            kept and can still be viewed.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="h-11"
              disabled={activate.isPending}
              onClick={() => activate.mutate(term.id, { onSuccess: onClose })}
            >
              {activate.isPending ? "Saving..." : "Set as active"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const SchoolYearsIndex = () => {
  const { data: years, isPending, isError } = useSchoolYears();
  const [isWizardOpen, setIsWizardOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [activating, setActivating] = React.useState<{ term: SchoolYearTerm; year: SchoolYear } | null>(null);

  const activeTerm = years?.flatMap(({ terms }) => terms).find(({ is_active }) => is_active);
  const editing = years?.find(({ id }) => id === editingId);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#790D16]/20 rounded-sm">
            <CalendarDays className="text-branding size-5" />
          </div>
          <div>
            <p className="text-branding text-xl font-medium">School Years</p>
            <p className="text-sm text-neutral-700">
              {activeTerm ? `Active now: ${activeTerm.name}` : "No term is active yet."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="h-11 shrink-0"
          disabled={!years}
          onClick={() => setIsWizardOpen(true)}
        >
          <Plus />
          Start New School Year
        </Button>
      </div>

      <details className="rounded-md border bg-background">
        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm font-medium">
          How this works
        </summary>
        <ol className="list-decimal space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
          {HOW_IT_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </details>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the school years.</p>}
      {years?.length === 0 && (
        <p className="text-sm text-neutral-700">
          There is no school year yet. Start the first one to begin.
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {years?.map((year) => (
          <Card key={year.id} className="shadow shadow-[#790D16]/40">
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-teal-700 font-bold text-base">SY {year.name}</p>
                  <p className="text-xs text-neutral-700">
                    {formatDate(year.start_date)} to {formatDate(year.end_date)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={() => setEditingId(year.id)}
                >
                  <Settings2 />
                  Calendar settings
                </Button>
              </div>

              <ul className="divide-y border-t">
                {year.terms.map((term) => (
                  <li
                    key={term.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{term.name}</p>
                      <p className="text-xs text-neutral-700">
                        {formatDate(term.start_date)} to {formatDate(term.end_date)}
                      </p>
                    </div>
                    {term.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-900">Active</Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => setActivating({ term, year })}
                      >
                        Set as active
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {isWizardOpen && years && (
        <StartYearWizard
          years={years}
          activeTermName={activeTerm?.name}
          onClose={() => setIsWizardOpen(false)}
        />
      )}

      {editing && (
        <CalendarSettingsSheet
          key={editing.id}
          year={editing}
          onClose={() => setEditingId(null)}
        />
      )}

      {activating && (
        <ActivateTermSheet
          key={activating.term.id}
          term={activating.term}
          yearName={activating.year.name}
          currentName={activeTerm?.name}
          onClose={() => setActivating(null)}
        />
      )}
    </div>
  );
};

export default SchoolYearsIndex;
