import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus } from "lucide-react";
import React from "react";
import { useParams } from "react-router";

const ShsGenerateScheduleDetail = () => {
  const { id } = useParams();
  const roomId = id ? Number(id) : null;
  return (
    <>
      <div>
        <div className="p-3 space-y-3">
          <Card>
            <CardContent>Room: 101</CardContent>
          </Card>
          <Collapsible>
            <div className="flex justify-between  items-center border rounded-lg p-3">
              <CollapsibleTrigger>Monday</CollapsibleTrigger>
              <Button size="xs">
                <Plus /> Add Schedule
              </Button>
            </div>
            <CollapsibleContent>
              Yes. Free to use for personal and commercial projects. No
              attribution required.
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </>
  );
};

export default ShsGenerateScheduleDetail;
