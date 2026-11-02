import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Logs } from "lucide-react";

const RoomLogs = () => {
  return (
    <>
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="outline" size="icon-sm">
              <Logs />
            </Button>
          }
        />
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Room Schedule Log</SheetTitle>
            <SheetDescription>
              Review which sections occupied this room each day, including their
              time slots.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col items-center mt-16 space-y-5">
            <div>
              <Logs className="text-branding" />
            </div>
            <p>Logs will listed here.</p>
          </div>
          <SheetFooter>
            {/* <Button type="submit">Save changes</Button> */}
            <SheetClose render={<Button>Close</Button>} />
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default RoomLogs;
