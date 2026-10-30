import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutGridCircles, MoveRight } from "lucide-react";
import React from "react";


type ScheduleCardProp = {
    action:  React.ReactNode ,
    title: string,
    startTime: string,
    endTime: string,
    
}
const ScheduleCard = ({ action }: { action: React.ReactNode }) => {
  return (
    <>
      <Card>
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
              {/* <EditSectionToClassroom day={day} /> */}
              {action}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default ScheduleCard;
