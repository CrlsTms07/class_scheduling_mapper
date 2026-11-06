import {
  Blocks,
  Building,
  CalendarCheck,
  CirclePile,
  CircleUserRound,
  FolderUser,
  LayoutDashboard,
  UserGroup,
} from "lucide-react";
import { NavLink } from "react-router";

const AppSideBar = () => {
  const navigationDetail = [
    {
      label: "Main",
      navigationArr: [
        {
          symbol: LayoutDashboard,
          name: "Dashboard",
          path: ".",
          end: true,
        },
        {
          symbol: CalendarCheck,
          name: "Schedule",
          path: "schedule",
        },
        {
          symbol: CircleUserRound,
          name: "Teachers",
          path: "coming-soon",
        },
        {
          symbol: Blocks,
          name: "Sections",
          path: "coming-soon",
        },
        {
          symbol: FolderUser,
          name: "Reports",
          path: "coming-soon",
        },
      ],
    },
    {
      label: "Manage",
      navigationArr: [
        {
          symbol: CirclePile,
          name: "Subjects",

          path: "coming-soon",
        },
        {
          symbol: Building,
          name: "Building",

          path: "coming-soon",
        },
        {
          symbol: UserGroup,
          name: "Users",

          path: "coming-soon",
        },
      ],
    },
  ];
  return (
    <>
      <div className="w-64 border-e h-screen">
        {navigationDetail.map((navSet) => (
          <div key={navSet.label} className="p-5 space-y-2">
            <p className="text-neutral-600 text-sm pl-3">{navSet.label}</p>

            {navSet.navigationArr.map(({ name, path, end, symbol: Icon }) => (
              <NavLink
                key={name}
                to={path}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-[#790D16] text-white"
                      : "text-neutral-700 hover:bg-[#790D16]/5"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={isActive ? "text-white" : "text-[#790D16]"}
                    />
                    <p className="text-sm">{name}</p>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </>
  );
};

export default AppSideBar;
