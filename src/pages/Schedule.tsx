import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Container from "@/components/global-component/Container";
import ClassroomList from "@/features/schedule/ClassroomList";

const Schedule = () => {
  const building = [
    {
      name: "Building 12",
    },
    {
      name: "Building 13",
    },
    {
      name: "Building 14",
    },
  ];
  return (
    <>
      <Container className="p-6">
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
              {building.map(({ name }) => (
                <TabsTrigger value={name} key={name}>
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>
            {building.map(({ name }) => (
              <TabsContent value={name} key={name} className="mt-10">
                {/* component */}
                <ClassroomList />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </Container>
    </>
  );
};

export default Schedule;
