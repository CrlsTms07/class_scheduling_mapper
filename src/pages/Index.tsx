import AppHeader from "@/layout/AppHeader";
import AppSideBar from "@/layout/AppSideBar";
import Container from "@/layout/Container";
import React from "react";
import { Outlet } from "react-router";

const Index = () => {
  return (
    <>
      <Container>
        <div>
          <div className="sticky top-0">
            <AppHeader />
          </div>
          <div>
            <div className=" fixed">
              <AppSideBar />
            </div>
            <div className="ml-72">
              <Outlet />
            </div>
          </div>
        </div>
      </Container>
    </>
  );
};

export default Index;
