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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useComboboxAnchor } from "@/hooks/useComboboxAnchor";
import { Plus } from "lucide-react";

const ManageSchedule = () => {
  const anchor = useComboboxAnchor();
  const sections = [
    "STEM 11-1",
    "STEM 11-2",
    "STEM 11-3",
    "STEM 12-1",
    "ABM 11-1",
    "ABM 11-2",
    "ABM 11-3",
  ] as const;
  return (
    <>
      <Dialog>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm">
              <Plus /> Add Section
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add section to this building</DialogTitle>
            <DialogDescription>
              Select/Unselect section below you want to add or edit.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Combobox
              multiple
              autoHighlight
              items={sections}
              defaultValue={[sections[0], sections[3]]}
            >
              <ComboboxChips ref={anchor}>
                <ComboboxValue>
                  {(values) => (
                    <>
                      {values.map((value: string) => (
                        <ComboboxChip key={value}>{value}</ComboboxChip>
                      ))}
                      <ComboboxChipsInput placeholder="Select Sections" />
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
          </div>
          <DialogFooter className="border-t pt-3 mt-5">
            <Button variant="outline" className="w-28">
              Cancel
            </Button>
            <Button className="w-28">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ManageSchedule;
