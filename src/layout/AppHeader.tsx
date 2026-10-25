import React from "react";
import HeroLogo from "@/assets/login/hero-logo.png";
import { Bell, PenLine } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const AppHeader = () => {
  const schoolYear = `${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`;
  return (
    <>
      <div className="py-3 px-6 border-b">
        <div className="flex justify-between items-center">
          <div className="flex items-center ">
            <img
              src={HeroLogo}
              alt="hero-logo"
              className="aspect-auto object-contain w-14"
            />
            <div className="ml-5">
              <p className="font-medium text-[#790D16] ">
                ERCIHS - Scheduling Mapper
              </p>
              <div className="flex items-center gap-2">
                <PenLine className="size-3" />
                <p className="text-xs">Sy. {schoolYear}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-16 mr-16">
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs">Cora Nogales</p>
                <Badge className="bg-[#790D16] text-[10px]">Chairperson</Badge>
              </div>
            </div>
            <div className="bg-mauve-100 p-2 rounded-full">
              <Bell className="text-[#790D16] size-5" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AppHeader;
