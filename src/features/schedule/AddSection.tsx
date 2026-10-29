import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Plus } from "lucide-react";

const AddSection = () => {
  const sections = [
    "STEM 11",
    "STEM 12",
    "ABM 11",
    "ABMM 12",
    "EIM 11",
    "EIM 12",
  ];
  return (
    <>
      <Sheet>
        <SheetTrigger
          render={
            <Button>
              <Plus /> Section
            </Button>
          }
        />
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Section List</SheetTitle>
            <SheetDescription>
              Select section to add in the classroom.
            </SheetDescription>
          </SheetHeader>
          <div>
            <Field className="w-88">
              <FieldLabel htmlFor="time-picker-optional">Section</FieldLabel>
              <Combobox items={sections}>
                <ComboboxInput placeholder="Select a section" showClear />
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
            </Field>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default AddSection;
