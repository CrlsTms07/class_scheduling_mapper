import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  useCopyPattern,
  useCreatePattern,
  useDeletePattern,
  useUpdatePattern,
} from "@/api/timeSlots";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import { DAY_NAMES, WEEK_DAYS } from "@/lib/schedule";
import { LEVELS, PatternSchema, SHIFT_LABELS, SHIFTS } from "@/lib/timeSlots";
import type { ManagedPattern, PatternInput, SchoolLevel, Shift } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
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

export type PatternAction =
  | { mode: "create"; level: SchoolLevel; shift: Shift }
  | { mode: "edit"; pattern: ManagedPattern }
  | { mode: "copy"; pattern: ManagedPattern };

const SELECT_CLASS = "w-full [&_select]:h-11";

function startingValues(action: PatternAction): PatternInput {
  if (action.mode === "create") {
    return { level: action.level, shift: action.shift, name: "", days: [] };
  }

  const { level, shift, name, days } = action.pattern;

  // A copy goes to another shift by default, since these days are taken in this one.
  return action.mode === "copy"
    ? { level, shift: SHIFTS.find((item) => item !== shift) ?? shift, name, days }
    : { level, shift, name, days };
}

const TITLES: Record<PatternAction["mode"], string> = {
  create: "Add bell schedule",
  edit: "Edit bell schedule",
  copy: "Copy bell schedule",
};

type PatternSheetProp = {
  yearId: number;
  action: PatternAction;
  /** Tells the page where the saved bell schedule is, so it can show it. */
  onSaved: (level: SchoolLevel, shift: Shift) => void;
  onClose: () => void;
};

const PatternSheet = ({ yearId, action, onSaved, onClose }: PatternSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const patternId = action.mode === "create" ? 0 : action.pattern.id;

  const create = useCreatePattern(yearId);
  const update = useUpdatePattern(patternId);
  const copy = useCopyPattern(patternId);
  const remove = useDeletePattern(patternId);

  const form = useForm<PatternInput>({
    resolver: zodResolver(PatternSchema),
    defaultValues: startingValues(action),
  });

  const save = { create, edit: update, copy }[action.mode];

  const handleSave = form.handleSubmit((values) =>
    save.mutate(values, { onSuccess: () => onSaved(values.level, values.shift) }),
  );

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">{TITLES[action.mode]}</SheetTitle>
          <SheetDescription>
            {action.mode === "create" &&
              `For ${action.level}, ${SHIFT_LABELS[action.shift]}. Add its periods and breaks after saving.`}
            {action.mode === "edit" &&
              `For ${action.pattern.level}, ${SHIFT_LABELS[action.pattern.shift]}.`}
            {action.mode === "copy" &&
              `Makes a new bell schedule with the same periods and breaks as ${action.pattern.name}.`}
          </SheetDescription>
        </SheetHeader>

        <form noValidate className="space-y-4 px-4 pb-4" onSubmit={handleSave}>
          {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
          {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}

          {action.mode === "copy" && (
            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="level"
                control={form.control}
                render={({ field }) => (
                  <div className="space-y-1">
                    <label htmlFor="copy-level" className="text-sm text-neutral-800">
                      Department
                    </label>
                    <NativeSelect id="copy-level" className={SELECT_CLASS} {...field}>
                      {LEVELS.map((level) => (
                        <NativeSelectOption key={level} value={level}>
                          {level}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              />
              <Controller
                name="shift"
                control={form.control}
                render={({ field }) => (
                  <div className="space-y-1">
                    <label htmlFor="copy-shift" className="text-sm text-neutral-800">
                      Shift
                    </label>
                    <NativeSelect id="copy-shift" className={SELECT_CLASS} {...field}>
                      {SHIFTS.map((shift) => (
                        <NativeSelectOption key={shift} value={shift}>
                          {SHIFT_LABELS[shift]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              />
            </div>
          )}

          <FormTextField
            control={form.control}
            name="name"
            label="Name"
            placeholder="Monday – Thursday"
          />

          <Controller
            name="days"
            control={form.control}
            render={({ field, fieldState }) => (
              <fieldset className="space-y-1">
                <legend className="text-sm text-neutral-800">Days that use this schedule</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {WEEK_DAYS.map((day) => {
                    const isOn = field.value.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={isOn}
                        onClick={() =>
                          field.onChange(
                            isOn
                              ? field.value.filter((item) => item !== day)
                              : [...field.value, day].sort(),
                          )
                        }
                        className={`min-h-11 rounded-md border px-2 text-sm font-medium ${
                          isOn
                            ? "bg-[#790D16] text-white border-[#790D16]"
                            : "bg-background text-neutral-700"
                        }`}
                      >
                        {DAY_NAMES[day]}
                      </button>
                    );
                  })}
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </fieldset>
            )}
          />

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>

          {action.mode === "edit" && (
            <ConfirmDelete
              label="Delete this bell schedule"
              blockedReason={action.pattern.locked_reason}
              isPending={remove.isPending}
              onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
            />
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default PatternSheet;
