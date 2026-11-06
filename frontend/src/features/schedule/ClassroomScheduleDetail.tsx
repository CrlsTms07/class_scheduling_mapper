import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { DoorClosed } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AddSection from "./AddSection";
import RoomDailySchedule from "./RoomDailySchedule";
import BreadCrumbs from "@/components/global-component/BreadCrumbs";
import RoomLogs from "./RoomLogs";

const ClassroomScheduleDetail = () => {
  return (
    <>
      <div className="p-3">
        <BreadCrumbs />
        <div className="p-2 space-y-3">
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-[#790D16]/10 p-2 rounded-sm">
                  <DoorClosed className="text-branding" />
                </div>
                <div>
                  <p className="text-xl font-bold text-teal-700">A-101</p>
                  <p className="text-neutral-700 text-xs">Building 14-A</p>
                </div>
              </div>
              <div className="space-x-3">
                <AddSection />
                <RoomLogs />
              </div>
            </div>
            <div className="flex items-center border-t pt-2 space-x-3">
              <p className="text-xs text-neutral-700">Sections:</p>
              <Badge variant="secondary">STEM 11-1</Badge>
              <Badge variant="secondary">STEM 12-1</Badge>
            </div>
          </CardContent>
          <Tabs defaultValue="1st" className="w-full mt-5">
            <TabsList className="w-full">
              <TabsTrigger value="1st">1st Semester</TabsTrigger>
              <TabsTrigger value="2nd">2nd Semester</TabsTrigger>
              <TabsTrigger value="3rd">3rd Semester</TabsTrigger>
            </TabsList>
            <TabsContent value="1st">
              <RoomDailySchedule />
            </TabsContent>
            <TabsContent value="2nd">
              <RoomDailySchedule />
            </TabsContent>
            <TabsContent value="3rd">
              <RoomDailySchedule />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default ClassroomScheduleDetail;
