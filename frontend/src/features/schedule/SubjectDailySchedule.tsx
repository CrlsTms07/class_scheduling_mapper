import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  GraduationCap,
  MoveRight,
  SearchIcon,
  Trash,
  UserRound,
} from "lucide-react";
import SessionBreak from "./SessionBreak";
import { Button } from "@/components/ui/button";

const SubjectDailySchedule = () => {
  const Days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return (
    <>
      <div className="my-10 ">
        <div className="flex items-center gap-2">
          <p className="text-lg text-neutral-900">Section`s Daily Schedule</p>
          <Badge variant="secondary">June - August</Badge>
        </div>
        <p className="text-xs text-neutral-500">
          Plan and manage your weekly class schedule. Add subjects, assign
          teachers, and set the time for each day.
        </p>
      </div>
      <div className="flex items-center gap-3 my-5">
        <p className="font-medium text-neutral-700">Manage Session/s Breaks</p>
        <SessionBreak />
      </div>
      <div className="space-y-16">
        {Days.map((day, i) => (
          <div key={i}>
            <div className="flex justify-between items-center border-b border-t p-2">
              <div className="flex items-center gap-3">
                <p className="font-bold text-branding">{day}</p>
                <div className="flex items-center gap-2">
                  <GraduationCap className="size-5 text-neutral-700" />
                  <p className="text-lg font-bold text-teal-700">5</p>
                  <p className="text-xs">Subjects</p>
                </div>
              </div>
              <div>
                <InputGroup>
                  <InputGroupInput
                    id="inline-start-input"
                    placeholder="Search..."
                  />
                  <InputGroupAddon align="inline-start">
                    <SearchIcon className="text-muted-foreground" />
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </div>
            <div className="grid grid-cols-3 items-center pt-3 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-4">
                            <p className="font-bold">GEN BIO 1</p>
                            <Badge className="bg-[#790D16]">60mins</Badge>
                          </div>
                          <div className="flex items-center gap-1  text-xs">
                            <p>6:00 am </p>
                            <MoveRight className="size-5" />
                            <p>7:00am </p>
                          </div>
                        </div>
                        <li className="list-disc marker:text-lime-600">
                          <p className="text-xs font-bold">Bldg 14-A. 101</p>
                        </li>
                      </div>
                      <div className="flex items-center pt-3 border-t gap-3">
                        <div className="bg-[#790D16]/20 p-1 rounded-sm">
                          <UserRound className="size-5 text-branding" />
                        </div>
                        <p className="text-xs">John Christian Olor</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <div>
                <Card>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="space-y-7">
                        <div>
                          <Button variant="destructive" size="icon-sm">
                            <Trash />
                          </Button>
                        </div>
                        {/* <div className="flex items-center">
                          <div className="bg-[#790D16]/20 p-1 rounded-sm">
                            <Cookie className="size-5 text-branding" />
                          </div>
                        </div> */}
                        <div>
                          <div>
                            <p className="font-bold">Break Time</p>
                          </div>
                          <div className="flex items-center gap-1  text-xs">
                            <p>6:00 am </p>
                            <MoveRight className="size-5" />
                            <p>6:30am </p>
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-[#790D16]">20 mins</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default SubjectDailySchedule;
