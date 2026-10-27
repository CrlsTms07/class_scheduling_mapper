import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Container from "@/layout/Container";
import ShsGenerateSchedule from "@/layout/sub-pages/ShsGenerateSchedule";

const GenerateSchedule = () => {
  return (
    <>
      <Container className="p-3">
        <div>
          <div>
            <p className="text-branding text-xl font-medium">
              Schedule Configuration
            </p>
            <p className="text-sm text-neutral-700 ">
              This page lets you build the weekly timetable for each section by
              assigning subjects, teachers, rooms, and time slots in one place.
            </p>
          </div>
          <Tabs defaultValue="account" className=" mt-10">
            <TabsList className="w-xl">
              <TabsTrigger value="account">Senior Highschool</TabsTrigger>
              <TabsTrigger value="password">Junior Highschool</TabsTrigger>
              <TabsTrigger value="break">Session Break</TabsTrigger>
            </TabsList>
            <TabsContent value="account">
              <ShsGenerateSchedule />
            </TabsContent>
            <TabsContent value="password">
              Change your password here.
            </TabsContent>
            <TabsContent value="break">Change your password here.</TabsContent>
          </Tabs>
        </div>
      </Container>
    </>
  );
};

export default GenerateSchedule;
