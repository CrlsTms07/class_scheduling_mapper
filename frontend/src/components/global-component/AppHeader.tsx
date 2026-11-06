import React from "react";
import HeroLogo from "@/assets/login/hero-logo.png";
import { Bell, LogOut, Menu } from "lucide-react";
import { useLogout, useMe } from "@/api/auth";
import { ROLE_LABELS } from "@/lib/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import AppSideBar from "./AppSideBar";
import TermSelect from "./TermSelect";

const AppHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { data: user } = useMe();
  const logout = useLogout();

  const initials = `${user?.first_name[0] ?? ""}${user?.last_name[0] ?? ""}`;

  return (
    <div className="bg-background py-2 px-3 sm:py-3 sm:px-6 max-lg:landscape:py-1 border-b backdrop-blur-lg">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center min-w-0">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open menu"
                  className="size-11 shrink-0 lg:hidden"
                >
                  <Menu />
                </Button>
              }
            />
            <SheetContent side="left" className="overflow-y-auto">
              <SheetTitle className="px-8 pt-5 text-branding">Menu</SheetTitle>
              <AppSideBar onNavigate={() => setIsMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <img
            src={HeroLogo}
            alt="hero-logo"
            className="aspect-auto object-contain w-10 sm:w-14 max-lg:landscape:w-8 shrink-0"
          />
          <div className="ml-2 sm:ml-5 min-w-0">
            <p className="font-medium text-[#790D16] text-sm sm:text-base truncate">
              ERCIHS - Scheduling Mapper
            </p>
          </div>
          <TermSelect className="hidden sm:block ml-4 w-64 max-lg:w-52 shrink-0" />
        </div>
        <div className="flex items-center gap-2 lg:gap-6 lg:mr-6 shrink-0">
          <div className="flex items-center gap-2">
            <Avatar className="hidden xl:flex">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden xl:block">
              <p className="text-xs">
                {user?.first_name} {user?.last_name}
              </p>
              {user?.role && (
                <Badge className="bg-[#790D16] text-[10px]">
                  {ROLE_LABELS[user.role]}
                </Badge>
              )}
            </div>
          </div>
          <div className="hidden xl:block bg-mauve-100 p-2 rounded-full">
            <Bell className="text-[#790D16] size-5" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            className="size-11"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut className="text-[#790D16]" />
          </Button>
        </div>
      </div>
      <TermSelect className="sm:hidden mt-1 w-full" />
    </div>
  );
};

export default AppHeader;
