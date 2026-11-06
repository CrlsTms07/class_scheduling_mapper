import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useComboboxAnchor } from "@/hooks/useComboboxAnchor";
import { AddClassSchedule } from "@/types/FieldSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

const SessionBreak = () => {
  const anchor = useComboboxAnchor();
  const form = useForm<z.infer<typeof AddClassSchedule>>({
    resolver: zodResolver(AddClassSchedule),
    defaultValues: {
      section: "",
      startTime: "",
      endTime: "",
      subject: "",
      teacher: "",
    },
    mode: "onSubmit",
  });

  const Days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ] as const;
  return (
    <>
      <Dialog>
        <DialogTrigger
          render={
            <Button size="sm">
              <Plus />
              Break Time
            </Button>
          }
        />
        <DialogContent>
          <div>
            <form onSubmit={form.handleSubmit((data) => console.log(data))}>
              <DialogHeader>
                <DialogTitle>Add break time</DialogTitle>
                <DialogDescription>
                  Set a break period that will be excluded from the schedule.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center flex-col overflow-y-auto space-y-5 mt-5">
                <Controller
                  name="startTime"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="time-picker-optional">
                        Start Time
                      </FieldLabel>
                      <Input
                        {...field}
                        aria-invalid={fieldState.invalid}
                        type="time"
                        id="time-picker-optional"
                        step="1"
                        defaultValue="10:30"
                        className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="endTime"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="time-picker-optional">
                        End Time
                      </FieldLabel>
                      <Input
                        {...field}
                        aria-invalid={fieldState.invalid}
                        type="time"
                        id="time-picker-optional"
                        step="1"
                        defaultValue="10:30"
                        className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="endTime"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="time-picker-optional">
                        Type
                      </FieldLabel>
                      <NativeSelect {...field}>
                        <NativeSelectOption value="">
                          Select a type
                        </NativeSelectOption>
                        <NativeSelectOption value="apple">
                          Break Time
                        </NativeSelectOption>
                        <NativeSelectOption value="apple">
                          Lunch Time
                        </NativeSelectOption>
                      </NativeSelect>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="endTime"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel htmlFor="time-picker-optional">
                        Day
                      </FieldLabel>
                      <Combobox multiple autoHighlight items={Days}>
                        <ComboboxChips ref={anchor}>
                          <ComboboxValue>
                            {(values) => (
                              <>
                                {values.map((value: string) => (
                                  <ComboboxChip key={value}>
                                    {value}
                                  </ComboboxChip>
                                ))}
                                <ComboboxChipsInput
                                  {...field}
                                  placeholder="Select Day/s"
                                />
                              </>
                            )}
                          </ComboboxValue>
                        </ComboboxChips>
                        <ComboboxContent anchor={anchor}>
                          <ComboboxEmpty>No items found.</ComboboxEmpty>
                          <ComboboxList>
                            {(item) => (
                              <ComboboxItem key={item} value={item}>
                                {item}
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
              <DialogFooter className="mt-16">
                <DialogClose
                  render={
                    <Button variant="outline" type="button" className="w-36">
                      Close
                    </Button>
                  }
                />
                <Button type="submit" className="w-36">
                  Submit
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SessionBreak;
