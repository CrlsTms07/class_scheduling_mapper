import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { MAX_TERMS, termName } from "@/lib/schoolYear";
import type { SchoolYearInput } from "@/types/api";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";

export type CalendarForm = UseFormReturn<SchoolYearInput>;

/** The school year's name and dates. */
export const YearFields = ({ form }: { form: CalendarForm }) => (
  <div className="space-y-4">
    <FormTextField control={form.control} name="name" label="School year" placeholder="2027-2028" />
    <div className="grid grid-cols-2 gap-3">
      <FormTextField control={form.control} name="start_date" label="First day" type="date" />
      <FormTextField control={form.control} name="end_date" label="Last day" type="date" />
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
              <FormTextField
                control={form.control}
                name={`terms.${index}.start_date`}
                label="Starts"
                type="date"
              />
              <FormTextField
                control={form.control}
                name={`terms.${index}.end_date`}
                label="Ends"
                type="date"
              />
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
