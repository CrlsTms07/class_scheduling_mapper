import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutGridCircles,
  MoveRight,
  Pencil,
  Plus,
  UserRoundGroup,
} from "lucide-react";

const ShsDailySchedule = () => {
  const Days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return (
    <>
      <div className="my-10 ">
        <p className="text-lg text-neutral-700">Daily Schedule</p>
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
              <div className="flex items-center gap-3">
                <Button size="xs">
                  <Plus /> Add Schedule
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 pt-3 gap-3">
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
                          <p className="text-xs">John Christian Olor</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button variant="secondary" className="w-full">
                          <Pencil />
                          Edit
                        </Button>
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

export default ShsDailySchedule;
