import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useDeleteSchoolYear, useUpdateSchoolYear } from "@/api/calendar";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import { SchoolYearSchema } from "@/lib/schoolYear";
import type { SchoolYear, SchoolYearInput } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TermFields, YearFields } from "./CalendarFields";

/** Fixes dates and names, or changes the term structure of an existing school year. */
const CalendarSettingsSheet = ({ year, onClose }: { year: SchoolYear; onClose: () => void }) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const update = useUpdateSchoolYear(year.id);
  const remove = useDeleteSchoolYear(year.id);
  const form = useForm<SchoolYearInput>({
    resolver: zodResolver(SchoolYearSchema),
    defaultValues: {
      name: year.name,
      start_date: year.start_date,
      end_date: year.end_date,
      term_label: year.term_label,
      terms: year.terms.map(({ name, start_date, end_date }) => ({ name, start_date, end_date })),
    },
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">Calendar settings</SheetTitle>
          <SheetDescription>School year {year.name}</SheetDescription>
        </SheetHeader>

        <form
          noValidate
          className="space-y-5 px-4 pb-4"
          onSubmit={form.handleSubmit((values) => update.mutate(values, { onSuccess: onClose }))}
        >
          {update.isError && <FormAlert>{apiErrorMessage(update.error)}</FormAlert>}
          {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}

          <YearFields form={form} />
          <TermFields
            form={form}
            canChangeStructure
            removeBlockedBy={year.terms.map(({ cannot_remove_reason }) => cannot_remove_reason)}
          />

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="h-11" disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Save changes"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>

          <ConfirmDelete
            label="Delete this school year"
            blockedReason={year.cannot_delete_reason}
            isPending={remove.isPending}
            onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
          />
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default CalendarSettingsSheet;
