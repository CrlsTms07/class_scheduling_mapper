import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  useAddTrack,
  useCreateSection,
  useDeleteSection,
  useManagedSections,
  useSectionOptions,
  useUpdateSection,
} from "@/api/sections";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import {
  homeRoomSharedWith,
  SectionFormSchema,
  toSectionForm,
  toSectionInput,
  type SectionFormValues,
} from "@/lib/sections";
import { SHIFT_LABELS, SHIFTS } from "@/lib/timeSlots";
import type { ManagedSection } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
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

type SelectFieldProp = {
  form: ReturnType<typeof useForm<SectionFormValues>>;
  name: keyof SectionFormValues;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
};

const SelectField = ({ form, name, label, disabled, children }: SelectFieldProp) => (
  <Controller
    name={name}
    control={form.control}
    render={({ field, fieldState }) => (
      <div className="space-y-1">
        <label htmlFor={name} className="text-sm text-neutral-800">
          {label}
        </label>
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
      </div>
    )}
  />
);

type SectionSheetProp = {
  yearId: number;
  yearName: string;
  /** The section to edit, or null to add a new one. */
  section: ManagedSection | null;
  onClose: () => void;
};

const SectionSheet = ({ yearId, yearName, section, onClose }: SectionSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const { data: options } = useSectionOptions(yearId);
  const { data: sections } = useManagedSections(yearId);

  const create = useCreateSection(yearId);
  const update = useUpdateSection(section?.id ?? 0);
  const remove = useDeleteSection(section?.id ?? 0);
  const addTrack = useAddTrack();
  const save = section ? update : create;

  const [newTrack, setNewTrack] = React.useState("");
  const [isAddingTrack, setIsAddingTrack] = React.useState(false);

  const form = useForm<SectionFormValues>({
    resolver: zodResolver(SectionFormSchema),
    defaultValues: toSectionForm(section),
  });
  const gradeId = useWatch({ control: form.control, name: "grade_level_id" });
  const roomId = useWatch({ control: form.control, name: "home_room_id" });
  const shift = useWatch({ control: form.control, name: "shift" });
  const sharedWith = homeRoomSharedWith(
    sections ?? [],
    roomId === "" ? null : Number(roomId),
    shift,
    section?.id,
  );

  const level = options?.grade_levels.find(({ id }) => String(id) === gradeId)?.level;
  const isLocked = !!section?.locked_reason;

  const handleSave = form.handleSubmit((values) =>
    save.mutate(toSectionInput(values, level === "SHS"), { onSuccess: onClose }),
  );

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
            {section ? `Edit ${section.label}` : "Add section"}
          </SheetTitle>
          <SheetDescription>School year {yearName}</SheetDescription>
        </SheetHeader>

        <form noValidate className="space-y-4 px-4 pb-4" onSubmit={handleSave}>
          {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
          {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}
          {isLocked && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              {section?.locked_reason} The grade and shift can no longer change.
            </p>
          )}

          <SelectField form={form} name="grade_level_id" label="Grade level" disabled={isLocked}>
            <NativeSelectOption value="">Choose a grade level</NativeSelectOption>
            {options?.grade_levels.map(({ id, grade, level: gradeLevel }) => (
              <NativeSelectOption key={id} value={String(id)}>
                Grade {grade} ({gradeLevel})
              </NativeSelectOption>
            ))}
          </SelectField>

          <FormTextField control={form.control} name="name" label="Section name" placeholder="Honesty" />

          <SelectField form={form} name="shift" label="Shift" disabled={isLocked}>
            {SHIFTS.map((shift) => (
              <NativeSelectOption key={shift} value={shift}>
                {SHIFT_LABELS[shift]}
              </NativeSelectOption>
            ))}
          </SelectField>

          {level === "SHS" && (
            <div className="space-y-2">
              <SelectField form={form} name="track_id" label="Track (optional)">
                <NativeSelectOption value="">No track</NativeSelectOption>
                {options?.tracks.map(({ id, name }) => (
                  <NativeSelectOption key={id} value={String(id)}>
                    {name}
                  </NativeSelectOption>
                ))}
              </SelectField>

              {isAddingTrack ? (
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
              )}
            </div>
          )}

          <SelectField form={form} name="adviser_id" label="Adviser (optional)">
            <NativeSelectOption value="">None yet</NativeSelectOption>
            {options?.teachers.map(({ id, name, advises, advises_section_id: advisesId }) => (
              // One advisory per teacher: someone advising another section cannot be chosen.
              <NativeSelectOption
                key={id}
                value={String(id)}
                disabled={advisesId !== null && advisesId !== section?.id}
              >
                {advisesId !== null && advisesId !== section?.id ? `${name} (advises ${advises})` : name}
              </NativeSelectOption>
            ))}
          </SelectField>

          {level !== "SHS" && (
            <div className="space-y-2">
              <SelectField form={form} name="home_room_id" label="Home room (optional)">
                <NativeSelectOption value="">None yet</NativeSelectOption>
                {options?.rooms.map(({ id, label }) => (
                  <NativeSelectOption key={id} value={String(id)}>
                    {label}
                  </NativeSelectOption>
                ))}
              </SelectField>
              {sharedWith.length > 0 && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  This room is also the home room of {sharedWith.join(", ")} at the same time of
                  day. You can still save, but their schedules may conflict.
                </p>
              )}
            </div>
          )}

          <FormTextField
            control={form.control}
            name="class_size"
            label="Class size (optional)"
            placeholder="40"
          />

          <div className="flex flex-col gap-2 pt-2">
            {/* Without the choices, the form cannot tell JHS from SHS yet. */}
            <Button type="submit" className="h-11" disabled={save.isPending || !options}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>

          {section && (
            <ConfirmDelete
              label="Delete this section"
              blockedReason={section.locked_reason}
              isPending={remove.isPending}
              onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
            />
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default SectionSheet;
