import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  LayoutGridCircles,
  MoveRight,
  SearchIcon,
  UserRoundGroup,
} from "lucide-react";
import AddSectionToClassroom from "./AddSectionToClassroom";
import EditSectionToClassroom from "./EditSectionToClassroom";

const RoomDailySchedule = () => {
  const Days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return (
    <>
      <div className="my-10 ">
        <div className="flex items-center gap-2">
          <p className="text-lg text-neutral-700">Daily Schedule</p>
          <Badge variant="secondary">June - August</Badge>
        </div>
        <p className="text-xs text-neutral-500">
          Plan and manage your weekly class schedule. Add subjects, assign
          teachers, and set the time for each day.
        </p>
      </div>
      <div className="space-y-16">
        {Days.map((day, i) => (
          <div key={i}>
            <div className="flex justify-between items-center border-b border-t p-2">
              <div className="flex items-center gap-3">
                <p className="font-bold text-branding">{day}</p>
                <div className="flex items-center gap-2">
                  <UserRoundGroup className="size-5 text-neutral-700" />
                  <p className="text-lg font-bold text-teal-700">5</p>
                  <p className="text-xs">Section/s Onboard</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <InputGroup>
                  <InputGroupInput
                    id="inline-start-input"
                    placeholder="Search..."
                  />
                  <InputGroupAddon align="inline-start">
                    <SearchIcon className="text-muted-foreground" />
                  </InputGroupAddon>
                </InputGroup>
                {/* component */}
                <AddSectionToClassroom day={day} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 pt-3 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold">STEM 11-1</p>
                          <div className="flex items-center gap-1  text-xs">
                            <p>6:00 am </p>
                            <MoveRight className="size-5" />
                            <p>7:00am </p>
                          </div>
                        </div>
                        <Badge className="bg-[#790D16]">60mins</Badge>
                      </div>
                      <div className="flex items-center pt-3 border-t gap-3">
                        <div className="bg-[#790D16]/20 p-1 rounded-sm">
                          <LayoutGridCircles className="size-5 text-branding" />
                        </div>
                        <div>
                          <p className="text-xs">GEN BIO 2</p>
                          <p className="text-xs">Sample Teacher</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <EditSectionToClassroom day={day} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default RoomDailySchedule;
