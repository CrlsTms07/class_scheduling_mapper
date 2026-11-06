import AppHeader from "@/components/global-component/AppHeader";
import AppSideBar from "@/components/global-component/AppSideBar";
import Container from "@/components/global-component/Container";
import { Outlet } from "react-router";

const Index = () => {
  return (
    <>
      <Container>
        <div>
          <div className="sticky top-0 z-10">
            <AppHeader />
          </div>
          <div>
            <aside className="hidden lg:block fixed w-64 h-[calc(100dvh-5rem)] overflow-y-auto border-e">
              <AppSideBar />
            </aside>
            <main className="lg:ml-64 min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
      </Container>
    </>
  );
};

export default Index;
