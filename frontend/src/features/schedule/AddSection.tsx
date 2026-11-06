import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
import { SectionSchema } from "@/types/FieldSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

const AddSection = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const form = useForm<z.infer<typeof SectionSchema>>({
    resolver: zodResolver(SectionSchema),
    defaultValues: {
      gradeLevel: "",
      section: "",
    },
    mode: "onChange",
  });
  const gradeLevel = ["GRADE 11", "GRADE 12"];
  const classSection = [
    {
      value: "STEM",
      items: ["STEM 11-1", "STEM 11-2", "STEM 11-3"],
    },
    {
      value: "ABM",
      items: ["ABM 11-1", "ABM 11-2", "ABM 11-3"],
    },
  ] as const;
  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={() => {
          setIsOpen(!isOpen);
          form.reset();
        }}
      >
        <SheetTrigger
          render={
            <Button>
              <Plus /> Section
            </Button>
          }
        />
        <SheetContent>
          <form onSubmit={form.handleSubmit((data) => console.log(data))}>
            <SheetHeader>
              <SheetTitle>Section List</SheetTitle>
              <SheetDescription>
                Select section to add in the classroom.
              </SheetDescription>
            </SheetHeader>
            <div className="flex items-center flex-col overflow-y-auto space-y-5 mt-5">
              <Controller
                name="gradeLevel"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field className="w-88">
                    <FieldLabel htmlFor={field.name}>GradeLevel</FieldLabel>
                    <Combobox
                      items={gradeLevel}
                      value={field.value || null}
                      onValueChange={(value) => {
                        field.onChange(value ?? "");
                      }}
                    >
                      <ComboboxInput placeholder="Select a grade level" />
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
                name="section"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field className="w-88">
                    <FieldLabel htmlFor={field.name}>Section</FieldLabel>
                    <Combobox
                      items={classSection}
                      value={field.value || null}
                      onValueChange={(value) => {
                        field.onChange(value ?? "");
                      }}
                    >
                      <ComboboxInput
                        {...field}
                        aria-invalid={fieldState.invalid}
                        placeholder="Select a class section"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No section found.</ComboboxEmpty>
                        <ComboboxList>
                          {(group, index) => (
                            <ComboboxGroup
                              key={group.value}
                              items={group.items}
                            >
                              <ComboboxLabel>{group.value}</ComboboxLabel>
                              <ComboboxCollection>
                                {(item) => (
                                  <ComboboxItem key={item} value={item}>
                                    {item}
                                  </ComboboxItem>
                                )}
                              </ComboboxCollection>
                              {index < classSection.length - 1 && (
                                <ComboboxSeparator />
                              )}
                            </ComboboxGroup>
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
            <SheetFooter className="mt-28">
              <Button type="submit">Submit</Button>
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
    </>
  );
};

export default AddSection;
