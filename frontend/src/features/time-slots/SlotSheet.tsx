import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useAddSlot, useDeleteSlot, useUpdateSlot } from "@/api/timeSlots";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import { minutesBetween, slotName, SlotSchema } from "@/lib/timeSlots";
import type { ManagedPattern, ManagedSlot, SlotInput } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type SlotAction =
  | { mode: "add"; pattern: ManagedPattern; isBreak: boolean }
  | { mode: "edit"; pattern: ManagedPattern; slot: ManagedSlot };

function startingValues(action: SlotAction): SlotInput {
  if (action.mode === "edit") {
    const { is_break, label, start_time, end_time } = action.slot;
    return { is_break, label: label ?? "", start_time, end_time };
  }

  // A new one usually starts when the last one ends.
  return {
    is_break: action.isBreak,
    label: action.isBreak ? "Break" : "",
    start_time: action.pattern.slots.at(-1)?.end_time ?? "",
    end_time: "",
  };
}

const SlotSheet = ({ action, onClose }: { action: SlotAction; onClose: () => void }) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const slotId = action.mode === "edit" ? action.slot.id : 0;
  const lockedReason = action.mode === "edit" ? action.slot.locked_reason : null;

  const add = useAddSlot(action.pattern.id);
  const update = useUpdateSlot(slotId);
  const remove = useDeleteSlot(slotId);
  const save = action.mode === "add" ? add : update;

  const form = useForm<SlotInput>({
    resolver: zodResolver(SlotSchema),
    defaultValues: startingValues(action),
  });
  const { is_break: isBreak, start_time: start, end_time: end } = useWatch({
    control: form.control,
  }) as SlotInput;

  const minutes = start && end ? minutesBetween(start, end) : null;
  const title =
    action.mode === "edit"
      ? `Edit ${slotName(action.slot)}`
      : `Add ${isBreak ? "a break" : "a period"}`;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">{title}</SheetTitle>
          <SheetDescription>{action.pattern.name}</SheetDescription>
        </SheetHeader>

        <form
          noValidate
          className="space-y-4 px-4 pb-4"
          onSubmit={form.handleSubmit((values) => save.mutate(values, { onSuccess: onClose }))}
        >
          {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
          {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}
          {lockedReason && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              The times are locked. {lockedReason} You can still change the name.
            </p>
          )}

          <div role="group" aria-label="Type" className="grid grid-cols-2 gap-2">
            {[
              { value: false, text: "Class period" },
              { value: true, text: "Break" },
            ].map(({ value, text }) => {
              const isOn = value === isBreak;
              return (
                <button
                  key={text}
                  type="button"
                  aria-pressed={isOn}
                  disabled={!!lockedReason}
                  onClick={() => {
                    form.setValue("is_break", value);
                    form.clearErrors("label");
                  }}
                  className={`min-h-11 rounded-md border px-2 text-sm font-medium disabled:opacity-60 ${
                    isOn
                      ? "bg-[#790D16] text-white border-[#790D16]"
                      : "bg-background text-neutral-700"
                  }`}
                >
                  {text}
                </button>
              );
            })}
          </div>

          <FormTextField
            control={form.control}
            name="label"
            label={isBreak ? "Break name" : "Name (optional)"}
            placeholder={isBreak ? "Recess or Lunch" : "HGP"}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormTextField
              control={form.control}
              name="start_time"
              label="Starts"
              type="time"
              disabled={!!lockedReason}
            />
            <FormTextField
              control={form.control}
              name="end_time"
              label="Ends"
              type="time"
              disabled={!!lockedReason}
            />
          </div>

          <p className="text-sm text-neutral-700" aria-live="polite">
            {minutes ? `${minutes} minutes` : "Enter the times to see the minutes."}
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>

          {action.mode === "edit" && !lockedReason && (
            <ConfirmDelete
              label={`Delete ${isBreak ? "this break" : "this period"}`}
              isPending={remove.isPending}
              onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
            />
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default SlotSheet;
