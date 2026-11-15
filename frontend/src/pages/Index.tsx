import AppHeader from "@/components/global-component/AppHeader";
import AppSideBar from "@/components/global-component/AppSideBar";
import Container from "@/components/global-component/Container";
import SelectedTermProvider from "@/context/SelectedTermProvider";
import { Suspense } from "react";
import { Outlet } from "react-router";

const Index = () => {
  return (
    <SelectedTermProvider>
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
              <Suspense
                fallback={<p className="p-6 text-sm text-neutral-600">Loading...</p>}
              >
                <Outlet />
              </Suspense>
            </main>
          </div>
        </div>
      </Container>
    </SelectedTermProvider>
  );
};

export default Index;
