import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Logs, TableProperties } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SubjectDailySchedule from "./SubjectDailySchedule";

const SectionSubjectDetail = () => {
  const semester = [
    {
      name: "1st Semester",
    },
    {
      name: "2nd Semester",
    },
    {
      name: "3rd Semester",
    },
  ];
  return (
    <>
      <div className="p-3">
        <div className="p-2 space-y-3">
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-[#790D16]/10 p-2 rounded-sm">
                  <TableProperties className="text-branding" />
                </div>
                <div>
                  <p className="text-xl font-bold text-teal-700">STEM 11-1</p>
                  <p className="text-neutral-700 text-xs">Grade 11</p>
                </div>
              </div>
              <div className="space-x-3">
                <Button variant="outline" size="icon-sm">
                  <Logs />
                </Button>
              </div>
            </div>
            <div className="flex items-center border-t pt-2 space-x-3">
              <p className="text-xs text-neutral-700">Subjects:</p>
              <Badge variant="secondary">GEN BIO 1</Badge>
              <Badge variant="secondary">READING AND WRITING</Badge>
            </div>
          </CardContent>
          <Tabs defaultValue="account" className="w-full mt-5">
            <TabsList className="w-full">
              {semester.map(({ name }) => (
                <TabsTrigger value={name}>{name}</TabsTrigger>
              ))}
            </TabsList>
            {semester.map(({ name }) => (
              <TabsContent value={name}>
                <SubjectDailySchedule />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default SectionSubjectDetail;
