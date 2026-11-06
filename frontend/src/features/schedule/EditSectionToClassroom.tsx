import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AddClassSchedule } from "@/types/FieldSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

const EditSectionToClassroom = ({ day }: { day: string }) => {
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
  const classSection = ["STEM 11-1", "STEM 12-1"] as const;
  const classSubject = ["Biology 1", "Aralin Panglipunan"] as const;
  const subjectTeacher = [
    "Sample Teacher",
    "Another Teacher",
  ] as const;
  return (
    <>
      <div>
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="secondary" className="w-full">
                <Pencil />
                Edit
              </Button>
            }
          />
          <SheetContent className="flex flex-col h-full">
            <form onSubmit={form.handleSubmit((data) => console.log(data))}>
              <SheetHeader>
                <SheetTitle>Edit Section for {day} Schedule</SheetTitle>
                <SheetDescription className="text-xs">
                  Edit schedule for this item.
                </SheetDescription>
              </SheetHeader>
              <div className="flex items-center flex-col overflow-y-auto space-y-5 mt-5">
                <Controller
                  name="section"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field className="w-full px-4">
                      <FieldLabel htmlFor={field.name}>Section</FieldLabel>
                      <Combobox items={classSection}>
                        <ComboboxInput placeholder="Select a section" />
                        <ComboboxContent>
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
                <Controller
                  name="startTime"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field className="w-full px-4">
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
                    <Field className="w-full px-4">
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
                    <Field className="w-full px-4">
                      <FieldLabel htmlFor="time-picker-optional">
                        Subject
                      </FieldLabel>
                      <Combobox
                        items={classSubject}
                        defaultValue={classSubject[0]}
                      >
                        <ComboboxInput
                          {...field}
                          placeholder="Select a subject "
                          showClear
                        />
                        <ComboboxContent>
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
                <Controller
                  name="endTime"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field className="w-full px-4">
                      <FieldLabel htmlFor="time-picker-optional">
                        Teacher
                      </FieldLabel>
                      <Combobox
                        items={subjectTeacher}
                        defaultValue={subjectTeacher[0]}
                      >
                        <ComboboxInput
                          {...field}
                          placeholder="Select a teacher"
                          showClear
                        />
                        <ComboboxContent>
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
              <SheetFooter className="mt-16">
                <Button type="submit">Submit</Button>
                <Button type="button" variant="destructive">
                  Delete
                </Button>
                <SheetClose
                  render={
                    <Button
                      type="button"
                      onClick={() => form.reset()}
                      variant="outline"
                    >
                      Close
                    </Button>
                  }
                />
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default EditSectionToClassroom;
