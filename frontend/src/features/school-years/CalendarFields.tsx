import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";
import { dayMonthYear, MAX_TERMS, termName } from "@/lib/schoolYear";
import type { SchoolYearInput } from "@/types/api";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";

export type CalendarForm = UseFormReturn<SchoolYearInput>;

/** The chosen date as day/month/year under a date field, or a reminder that it is not set yet. */
const DateHint = ({ form, name }: { form: CalendarForm; name: `start_date` | `end_date` | `terms.${number}.start_date` | `terms.${number}.end_date` }) => {
  const value = (useWatch({ control: form.control, name }) as string | undefined) ?? "";
  const text = dayMonthYear(value);

  return (
    <p className={`text-xs ${text ? "text-neutral-700" : "text-amber-800"}`} aria-live="polite">
      {text || "Not set yet (dd/mm/yyyy)"}
    </p>
  );
};

/** The school year's name and dates. */
export const YearFields = ({ form }: { form: CalendarForm }) => (
  <div className="space-y-4">
    <FormTextField control={form.control} name="name" label="School year" placeholder="2027-2028" />
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <FormTextField control={form.control} name="start_date" label="First day" type="date" />
        <DateHint form={form} name="start_date" />
      </div>
      <div className="space-y-1">
        <FormTextField control={form.control} name="end_date" label="Last day" type="date" />
        <DateHint form={form} name="end_date" />
      </div>
    </div>
  </div>
);

type TermFieldsProp = {
  form: CalendarForm;
  /** When true, the label can be typed and terms added or removed at the end. */
  canChangeStructure: boolean;
  /** Why a term must stay, by position. Missing means it can be removed. */
  removeBlockedBy?: (string | null)[];
};

/**
 * Terms are numbered by their place in the list, and subjects depend on that number.
 * That is why only the last term has a Remove button.
 */
export const TermFields = ({ form, canChangeStructure, removeBlockedBy = [] }: TermFieldsProp) => {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "terms" });
  const lastIndex = fields.length - 1;
  const lastTermBlockedBy = removeBlockedBy[lastIndex] ?? null;

  return (
    <div className="space-y-4">
      {canChangeStructure && (
        <FormTextField
          control={form.control}
          name="term_label"
          label="Call each part a"
          placeholder="Term"
        />
      )}

      <ol className="space-y-3">
        {fields.map((field, index) => (
          <li key={field.id} className="rounded-md border p-3 space-y-3">
            <FormTextField
              control={form.control}
              name={`terms.${index}.name`}
              label={`Part ${index + 1} name`}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <FormTextField
                  control={form.control}
                  name={`terms.${index}.start_date`}
                  label="Starts"
                  type="date"
                />
                <DateHint form={form} name={`terms.${index}.start_date`} />
              </div>
              <div className="space-y-1">
                <FormTextField
                  control={form.control}
                  name={`terms.${index}.end_date`}
                  label="Ends"
                  type="date"
                />
                <DateHint form={form} name={`terms.${index}.end_date`} />
              </div>
            </div>
          </li>
        ))}
      </ol>

      {canChangeStructure && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={fields.length >= MAX_TERMS}
              onClick={() =>
                append({
                  name: termName(fields.length, form.getValues("term_label")),
                  start_date: "",
                  end_date: "",
                })
              }
            >
              <Plus />
              Add a part
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={fields.length <= 1 || lastTermBlockedBy !== null}
              onClick={() => remove(lastIndex)}
            >
              <Trash2 />
              Remove last
            </Button>
          </div>
          {lastTermBlockedBy && (
            <p className="text-xs text-neutral-700">
              Cannot remove the last part: {lastTermBlockedBy}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
