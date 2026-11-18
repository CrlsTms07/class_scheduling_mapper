import React from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router";
import { useMe } from "@/api/auth";
import { useNotifications } from "@/api/notifications";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { unreadCount } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const seenKey = (userId: number | undefined) => `notifications-seen-${userId ?? "none"}`;

/** Browser storage can be missing or blocked. The bell still works, it just forgets what was read. */
function readSeen(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSeen(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the count simply shows again next time.
  }
}

const NotificationBell = () => {
  const { data: user } = useMe();
  const { data: items = [] } = useNotifications();
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const [isOpen, setIsOpen] = React.useState(false);
  const key = seenKey(user?.id);
  const [seenAt, setSeenAt] = React.useState(() => readSeen(key));

  const unread = unreadCount(items, seenAt);

  const open = () => {
    setIsOpen(true);
    const now = new Date().toISOString();
    writeSeen(key, now);
    setSeenAt(now);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
        className="relative size-11 rounded-full bg-mauve-100"
        onClick={open}
      >
        <Bell className="text-[#790D16] size-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-5 h-5 items-center justify-center rounded-full bg-[#790D16] px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side={isPhonePortrait ? "bottom" : "right"} className="max-h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-branding">Notifications</SheetTitle>
            <SheetDescription>What needs your attention, and the Admin's recent decisions.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {items.length === 0 ? (
              <p className="text-sm text-neutral-700">Nothing new. You are all caught up.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {items.map((item) => (
                  <li key={item.key}>
                    <Link
                      to={item.link}
                      onClick={() => setIsOpen(false)}
                      className="block min-h-11 space-y-1 p-3 hover:bg-[#790D16]/5 focus-visible:outline-2 focus-visible:outline-[#790D16]"
                    >
                      <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                      <p className="text-xs text-neutral-700">{item.body}</p>
                      <p className="text-[11px] text-neutral-500">{new Date(item.at).toLocaleString()}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default NotificationBell;
