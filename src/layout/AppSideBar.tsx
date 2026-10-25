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

const AppSideBar = () => {
  const navigationDetail = [
    {
      label: "Main",
      navigationArr: [
        {
          symbol: LayoutDashboard,
          name: "Dashboard",
        },
        {
          symbol: CalendarCheck,
          name: "Schedule",
        },
        {
          symbol: CircleUserRound,
          name: "Teachers",
        },
        {
          symbol: Blocks,
          name: "Sections",
        },
        {
          symbol: FolderUser,
          name: "Reports",
        },
      ],
    },
    {
      label: "Manage",
      navigationArr: [
        {
          symbol: CirclePile,
          name: "Subjects",
        },
        {
          symbol: Building,
          name: "Building",
        },
        {
          symbol: UserGroup,
          name: "Users",
        },
      ],
    },
  ];
  return (
    <>
      <div className="w-72 border-e h-screen">
        {navigationDetail.map((navSet) => (
          <div key={navSet.label} className="p-7 space-y-2">
            <p className="text-neutral-600 text-sm pl-3">{navSet.label}</p>
            {navSet.navigationArr.map(({ name, symbol: Icon }) => (
              <div
                key={name}
                className="flex items-center gap-3 p-3 hover:bg-[#790D16]/5 hover:rounded-lg"
              >
                <Icon className="text-[#790D16]" />
                <p className="text-neutral-700 text-sm">{name}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
};

export default AppSideBar;
