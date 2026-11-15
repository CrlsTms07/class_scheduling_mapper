import { NavLink } from "react-router";
import { useMe } from "@/api/auth";
import { navigationFor } from "@/lib/navigation";
import SignOutButton from "./SignOutButton";

/**
 * The menu of the signed-in user's role. Used by the desktop sidebar
 * and by the phone drawer, which closes itself through onNavigate.
 */
const AppSideBar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { data: user } = useMe();

  return (
    <div className="flex min-h-full flex-col">
    <nav aria-label="Main menu" className="flex-1">
      {navigationFor(user?.role ?? null, Boolean(user?.personnel)).map((group) => (
        <div key={group.label} className="p-5 space-y-2">
          <p className="text-neutral-600 text-sm pl-3">{group.label}</p>

          {group.items.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onNavigate}
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
    </nav>
    {/* At the bottom of the menu, where people look for it last. */}
    <div className="border-t p-5">
      <SignOutButton />
    </div>
    </div>
  );
};

export default AppSideBar;
