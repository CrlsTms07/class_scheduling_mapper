import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, type Path, useWatch } from "react-hook-form";
import {
  useAddPersonnelOption,
  useDeletePersonnelOption,
  useCreateTeacher,
  useDeleteTeacher,
  usePersonnelOptions,
  useUpdateTeacher,
} from "@/api/teachers";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import {
  DEGREE_LEVELS,
  EMPTY_QUALIFICATION,
  PERSONNEL_TYPE_LABELS,
  TeacherFormSchema,
  toTeacherForm,
  toTeacherInput,
  type TeacherFormValues,
  DEFAULT_MAX_LOAD,
} from "@/lib/teachers";
import { SHIFT_LABELS, SHIFTS } from "@/lib/timeSlots";
import type { ManagedTeacher, PersonnelOptionType, Term } from "@/types/api";
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

type TeacherForm = ReturnType<typeof useForm<TeacherFormValues>>;

const SelectField = ({
  form,
  name,
  label,
  disabled,
  children,
}: {
  form: TeacherForm;
  name: Path<TeacherFormValues>;
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
          value={field.value as string}
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

/** Lets the user add a missing choice to a list without leaving the form. */
/** Takes a misspelled choice off the list. The API refuses one that is in use, and says so. */
const DeleteOption = ({
  type,
  label,
  id,
  onDeleted,
}: {
  type: PersonnelOptionType;
  label: string;
  id: number;
  onDeleted?: () => void;
}) => {
  const remove = useDeletePersonnelOption(type);

  return (
    <div className="space-y-2">
      {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}
      <ConfirmDelete
        label={`Delete this ${label}`}
        warning={`This removes the ${label} from the list. It only works if nobody uses it.`}
        isPending={remove.isPending}
        onConfirm={() => remove.mutate(id, { onSuccess: onDeleted })}
      />
    </div>
  );
};

const AddOption = ({
  type,
  label,
  onAdded,
}: {
  type: PersonnelOptionType;
  label: string;
  onAdded: (id: number) => void;
}) => {
  const add = useAddPersonnelOption(type);
  const [isOpen, setIsOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const inputId = `new-${type}`;

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setIsOpen(true)}>
        <Plus />
        New {label}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <label htmlFor={inputId} className="text-sm text-neutral-800">
        New {label} name
      </label>
      <Input id={inputId} className="h-11" value={name} onChange={(event) => setName(event.target.value)} />
      {add.isError && <FormAlert>{apiErrorMessage(add.error)}</FormAlert>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          className="h-11"
          disabled={name.trim() === "" || add.isPending}
          onClick={() =>
            add.mutate(name.trim(), {
              onSuccess: ({ data }) => {
                onAdded(data.id);
                setName("");
                setIsOpen(false);
              },
            })
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
};

type TeacherSheetProp = {
  term: Term;
  /** The record to edit, or null to add a new one. */
  teacher: ManagedTeacher | null;
  /** Opened with View: the same form, nothing can change. */
  isViewing?: boolean;
  onClose: () => void;
};

const TeacherSheet = ({ term, teacher, isViewing = false, onClose }: TeacherSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const { data: options } = usePersonnelOptions();
  const create = useCreateTeacher(term.id);
  const update = useUpdateTeacher(term.id, teacher?.id ?? 0);
  const remove = useDeleteTeacher(teacher?.id ?? 0);
  const save = teacher ? update : create;
  // A teacher who teaches only in the other department is shown, but the Admin edits it.
  const isOtherDepartment = teacher?.can_edit === false;
  const isReadOnly = isOtherDepartment || (isViewing && teacher !== null);

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(TeacherFormSchema),
    defaultValues: toTeacherForm(teacher),
  });
  const departmentId = useWatch({ control: form.control, name: "department_id" });
  const designationId = useWatch({ control: form.control, name: "designation_id" });
  const { fields, append, remove: removeQualification } = useFieldArray({
    control: form.control,
    name: "qualifications",
  });

  const title = !teacher ? "Add personnel" : isReadOnly ? teacher.printed_name : `Edit ${teacher.printed_name}`;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">{title}</SheetTitle>
          <SheetDescription>
            {teacher?.account_email
              ? `Signs in as ${teacher.account_email}`
              : "No login account. The Admin can link one in Users."}
          </SheetDescription>
        </SheetHeader>

        <form
          noValidate
          className="space-y-4 px-4 pb-4"
          onSubmit={form.handleSubmit((values) =>
            save.mutate(toTeacherInput(values), { onSuccess: onClose }),
          )}
        >
          {isOtherDepartment && (
            <FormAlert>
              This teacher teaches only in the other department, so this record is view only. The Admin keeps it up to date.
            </FormAlert>
          )}
          <fieldset disabled={isReadOnly} className="min-w-0 space-y-4">
            {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
            {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}

            <div className="space-y-4 min-w-0">
              <div className="grid grid-cols-2 gap-3">
                <FormTextField control={form.control} name="first_name" label="First name" />
                <FormTextField control={form.control} name="last_name" label="Last name" />
                <FormTextField control={form.control} name="middle_name" label="Middle name (optional)" />
                <FormTextField control={form.control} name="suffix" label="Suffix (optional)" />
              </div>

              <FormTextField
                control={form.control}
                name="display_name"
                label="Name printed on forms (optional)"
                placeholder="Leave empty to use first name, middle initial and last name"
              />

              <div className="grid grid-cols-2 gap-3">
                <SelectField form={form} name="personnel_type" label="Type">
                  {Object.entries(PERSONNEL_TYPE_LABELS).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </SelectField>
                <SelectField form={form} name="shift" label="Shift">
                  {SHIFTS.map((shift) => (
                    <NativeSelectOption key={shift} value={shift}>
                      {SHIFT_LABELS[shift]}
                    </NativeSelectOption>
                  ))}
                </SelectField>
              </div>

              <div className="space-y-2">
                <SelectField form={form} name="department_id" label="Department (optional)">
                  <NativeSelectOption value="">None yet</NativeSelectOption>
                  {options?.departments.map(({ id, name }) => (
                    <NativeSelectOption key={id} value={String(id)}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </SelectField>
                {departmentId !== "" && (
                  <DeleteOption
                    type="departments"
                    label="department"
                    id={Number(departmentId)}
                    onDeleted={() => form.setValue("department_id", "")}
                  />
                )}
                <AddOption
                  type="departments"
                  label="department"
                  onAdded={(id) => form.setValue("department_id", String(id))}
                />
              </div>

              <div className="space-y-2">
                <SelectField form={form} name="designation_id" label="Designation (optional)">
                  <NativeSelectOption value="">None yet</NativeSelectOption>
                  {options?.designations.map(({ id, name }) => (
                    <NativeSelectOption key={id} value={String(id)}>
                      {name}
                    </NativeSelectOption>
                  ))}
                </SelectField>
                {designationId !== "" && (
                  <DeleteOption
                    type="designations"
                    label="designation"
                    id={Number(designationId)}
                    onDeleted={() => form.setValue("designation_id", "")}
                  />
                )}
                <AddOption
                  type="designations"
                  label="designation"
                  onAdded={(id) => form.setValue("designation_id", String(id))}
                />
              </div>

              <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700">
                Maximum load: <span className="font-medium text-neutral-900">{teacher?.max_subjects ?? DEFAULT_MAX_LOAD} subjects</span>, the
                same for every teacher.
              </p>

              <FormTextField
                control={form.control}
                name="max_hours_per_week"
                label="Maximum hours a week (1 to 60)"
              />

              <Controller
                name="is_active"
                control={form.control}
                render={({ field }) => (
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      className="mt-0.5"
                      checked={field.value}
                   
                      onCheckedChange={field.onChange}
                    />
                    <span>
                      <span className="block text-sm font-medium text-neutral-900">Active</span>
                      <span className="block text-xs text-neutral-700">
                        Inactive people are no longer offered as advisers or for new loading.
                      </span>
                    </span>
                  </label>
                )}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">Educational qualifications</p>
                {fields.length === 0 && (
                  <p className="text-xs text-neutral-700">None added yet.</p>
                )}
                <ol className="space-y-3">
                  {fields.map((field, index) => (
                    <li key={field.id} className="space-y-3 rounded-md border p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <SelectField
                          form={form}
                          name={`qualifications.${index}.degree_level`}
                          label="Level"
                       
                        >
                          {DEGREE_LEVELS.map((level) => (
                            <NativeSelectOption key={level} value={level}>
                              {level}
                            </NativeSelectOption>
                          ))}
                        </SelectField>
                        <FormTextField
                          control={form.control}
                          name={`qualifications.${index}.degree`}
                          label="Degree"
                          placeholder="BSEd"
                        />
                        <FormTextField
                          control={form.control}
                          name={`qualifications.${index}.major`}
                          label="Major (optional)"
                        />
                        <FormTextField
                          control={form.control}
                          name={`qualifications.${index}.year_completed`}
                          label="Year (optional)"
                        />
                      </div>
                      <FormTextField
                        control={form.control}
                        name={`qualifications.${index}.school`}
                        label="School (optional)"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full text-destructive"
                        aria-label={`Remove qualification ${index + 1}`}
                        onClick={() => removeQualification(index)}
                      >
                        <Trash2 />
                        Remove
                      </Button>
                    </li>
                  ))}
                </ol>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => append({ ...EMPTY_QUALIFICATION })}
                >
                  <Plus />
                  Add qualification
                </Button>
              </div>

              <Controller
                name="task_ids"
                control={form.control}
                render={({ field }) => (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-900">
                      Teaching-related tasks in {term.name}
                    </p>
                    {options?.tasks.length === 0 && (
                      <p className="text-xs text-neutral-700">No tasks in the list yet.</p>
                    )}
                    {options?.tasks.map(({ id, name }) => (
                      <label
                        key={id}
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border p-3 text-sm text-neutral-900"
                      >
                        <Checkbox
                          checked={field.value.includes(id)}
                       
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, id]
                                : field.value.filter((item) => item !== id),
                            )
                          }
                        />
                        {name}
                      </label>
                    ))}
                    {(options?.tasks.length ?? 0) > 0 && (
                      <details className="rounded-md border">
                        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm">
                          Delete a task from the list
                        </summary>
                        <ul className="space-y-2 px-3 pb-3">
                          {options?.tasks.map(({ id, name }) => (
                            <li key={id}>
                              <DeleteOption type="teaching-tasks" label={`task: ${name}`} id={id} />
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <AddOption
                      type="teaching-tasks"
                      label="task"
                      onAdded={(id) => field.onChange([...field.value, id])}
                    />
                  </div>
                )}
              />
            </div>

          </fieldset>

          <div className="flex flex-col gap-2 pt-2">
            {!isReadOnly && (
              <Button type="submit" className="h-11" disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            )}
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>

          {teacher && !isReadOnly && (
            <ConfirmDelete
              label="Delete this record"
              blockedReason={teacher.cannot_delete_reason}
              isPending={remove.isPending}
              onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
            />
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default TeacherSheet;
