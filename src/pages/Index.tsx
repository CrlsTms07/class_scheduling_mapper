import AppHeader from "@/components/global-component/AppHeader";
import AppSideBar from "@/components/global-component/AppSideBar";
import Container from "@/components/global-component/Container";
import React from "react";
import { Outlet } from "react-router";

const Index = () => {
  return (
    <>
      <Container>
        <div>
          <div className="sticky top-0 z-1">
            <AppHeader />
          </div>
          <div>
            <div className=" fixed">
              <AppSideBar />
            </div>
            <div className="ml-64 z-0">
              <Outlet />
            </div>
          </div>
        </div>
      </Container>
    </>
  );
};

export default Index;
