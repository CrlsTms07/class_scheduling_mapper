import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useAddTrack } from "@/api/sections";
import {
  useCreateSubject,
  useDeleteSubject,
  useSubjectOptions,
  useUpdateSubject,
} from "@/api/subjects";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import {
  SUBJECT_TYPE_LABELS,
  SubjectFormSchema,
  toSubjectForm,
  toSubjectInput,
  type SubjectFormValues,
} from "@/lib/subjects";
import type { ManagedSubject } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type SubjectForm = ReturnType<typeof useForm<SubjectFormValues>>;

const SelectField = ({
  form,
  name,
  label,
  disabled,
  children,
}: {
  form: SubjectForm;
  name: "grade_level_id" | "track_id" | "term_no" | "subject_type";
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <Controller
    name={name}
    control={form.control}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={name} className="text-sm text-neutral-800">
          {label}
        </FieldLabel>
        <NativeSelect
          {...field}
          id={name}
          disabled={disabled}
          aria-invalid={fieldState.invalid}
          className="w-full [&_select]:h-11"
        >
          {children}
        </NativeSelect>
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);

const CheckField = ({
  form,
  name,
  title,
  hint,
  disabled,
}: {
  form: SubjectForm;
  name: "is_priority" | "is_active";
  title: string;
  hint: string;
  disabled: boolean;
}) => (
  <Controller
    name={name}
    control={form.control}
    render={({ field }) => (
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3">
        <Checkbox
          className="mt-0.5"
          checked={field.value}
          disabled={disabled}
          onCheckedChange={field.onChange}
        />
        <span>
          <span className="block text-sm font-medium text-neutral-900">{title}</span>
          <span className="block text-xs text-neutral-700">{hint}</span>
        </span>
      </label>
    )}
  />
);

type SubjectSheetProp = {
  yearId: number;
  yearName: string;
  /** The subject to edit or view, or null to add a new one. */
  subject: ManagedSubject | null;
  readOnly: boolean;
  onClose: () => void;
};

const SubjectSheet = ({ yearId, yearName, subject, readOnly, onClose }: SubjectSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const { data: options } = useSubjectOptions(yearId);
  const create = useCreateSubject(yearId);
  const update = useUpdateSubject(subject?.id ?? 0);
  const remove = useDeleteSubject(subject?.id ?? 0);
  const addTrack = useAddTrack();
  const save = subject ? update : create;

  const [newTrack, setNewTrack] = React.useState("");
  const [isAddingTrack, setIsAddingTrack] = React.useState(false);

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(SubjectFormSchema),
    defaultValues: toSubjectForm(subject),
  });
  const gradeId = useWatch({ control: form.control, name: "grade_level_id" });

  const level =
    options?.grade_levels.find(({ id }) => String(id) === gradeId)?.level ??
    (gradeId === String(subject?.grade_level_id) ? subject?.level : undefined);
  const isLocked = !!subject?.locked_reason;

  const handleAddTrack = () => {
    addTrack.mutate(newTrack.trim(), {
      onSuccess: ({ data }) => {
        form.setValue("track_id", String(data.id));
        setNewTrack("");
        setIsAddingTrack(false);
      },
    });
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">
            {readOnly ? subject?.name : subject ? `Edit ${subject.name}` : "Add subject"}
          </SheetTitle>
          <SheetDescription>School year {yearName}</SheetDescription>
        </SheetHeader>

        <form
          noValidate
          className="space-y-4 px-4 pb-4"
          onSubmit={form.handleSubmit((values) =>
            save.mutate(toSubjectInput(values, level === "SHS"), { onSuccess: onClose }),
          )}
        >
          {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
          {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}
          {isLocked && !readOnly && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              {subject?.locked_reason} Its grade, track and time of the year can no longer change.
            </p>
          )}

          {/* A disabled fieldset turns every input inside it read-only at once. */}
          <fieldset disabled={readOnly} className="space-y-4 min-w-0">
            <SelectField form={form} name="grade_level_id" label="Grade level" disabled={isLocked || readOnly}>
              <NativeSelectOption value="">Choose a grade level</NativeSelectOption>
              {options?.grade_levels.map(({ id, grade, level: gradeLevel }) => (
                <NativeSelectOption key={id} value={String(id)}>
                  Grade {grade} ({gradeLevel})
                </NativeSelectOption>
              ))}
            </SelectField>

            <FormTextField
              control={form.control}
              name="name"
              label="Subject name"
              placeholder="Mathematics 7"
            />

            {/* Core, Elective or Other is a Senior High idea (Strengthened SHS); Junior High subjects are all core. */}
            <div className={level === "SHS" ? "grid grid-cols-2 gap-3" : ""}>
              <FormTextField control={form.control} name="code" label="Code (optional)" placeholder="MATH7" />
              {level === "SHS" && (
                <SelectField form={form} name="subject_type" label="Type" disabled={readOnly}>
                  {Object.entries(SUBJECT_TYPE_LABELS).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </SelectField>
              )}
            </div>

            <div className="space-y-1">
              <FormTextField
                control={form.control}
                name="minutes_per_week"
                label="Minutes per week"
                placeholder="225"
              />
              <p className="text-xs text-neutral-700">
                The plotter flags a section whose schedule does not reach this exactly.
              </p>
            </div>

            <SelectField form={form} name="term_no" label="When it is taken" disabled={isLocked || readOnly}>
              <NativeSelectOption value="">Whole year</NativeSelectOption>
              {options?.terms.map(({ term_no: termNo, name }) => (
                <NativeSelectOption key={termNo} value={String(termNo)}>
                  {name}
                </NativeSelectOption>
              ))}
            </SelectField>

            {level === "SHS" && (
              <div className="space-y-2">
                <SelectField form={form} name="track_id" label="Track (optional)" disabled={isLocked || readOnly}>
                  <NativeSelectOption value="">All tracks</NativeSelectOption>
                  {options?.tracks.map(({ id, name }) => (
                    <NativeSelectOption key={id} value={String(id)}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </SelectField>

                {!readOnly && !isLocked && (
                  isAddingTrack ? (
                    <div className="space-y-2 rounded-md border p-3">
                      <label htmlFor="new-track" className="text-sm text-neutral-800">
                        New track name
                      </label>
                      <Input
                        id="new-track"
                        className="h-11"
                        value={newTrack}
                        onChange={(event) => setNewTrack(event.target.value)}
                      />
                      {addTrack.isError && <FormAlert>{apiErrorMessage(addTrack.error)}</FormAlert>}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11"
                          onClick={() => setIsAddingTrack(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="h-11"
                          disabled={newTrack.trim() === "" || addTrack.isPending}
                          onClick={handleAddTrack}
                        >
                          Add track
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full"
                      onClick={() => setIsAddingTrack(true)}
                    >
                      <Plus />
                      New track
                    </Button>
                  )
                )}
              </div>
            )}

            <CheckField
              form={form}
              name="is_priority"
              title="Priority subject"
              hint="Like PE and Homeroom, placed first when plotting."
              disabled={readOnly}
            />
            <CheckField
              form={form}
              name="is_active"
              title="Offered this school year"
              hint="A subject not offered is no longer available for new teacher loading."
              disabled={readOnly}
            />
          </fieldset>

          <div className="flex flex-col gap-2 pt-2">
            {!readOnly && (
              <Button type="submit" className="h-11" disabled={save.isPending || !options}>
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            )}
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>

          {subject && !readOnly && (
            <ConfirmDelete
              label="Delete this subject"
              blockedReason={
                subject.locked_reason && `${subject.locked_reason} Mark it as not offered instead.`
              }
              isPending={remove.isPending}
              onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
            />
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default SubjectSheet;
