import React from "react";
import { Bell, X } from "lucide-react";
import { Link } from "react-router";
import { useMe } from "@/api/auth";
import { useNotifications } from "@/api/notifications";
import { unreadCount } from "@/lib/notifications";
import { Button } from "@/components/ui/button";

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
  const [isOpen, setIsOpen] = React.useState(false);
  const key = seenKey(user?.id);
  const [seenAt, setSeenAt] = React.useState(() => readSeen(key));

  const unread = unreadCount(items, seenAt);

  // Escape closes the panel, like a dialog.
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const open = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    const now = new Date().toISOString();
    writeSeen(key, now);
    setSeenAt(now);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
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

      {isOpen && (
        <>
          {/* A tap outside closes it. */}
          <button type="button" aria-label="Close notifications" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setIsOpen(false)} />
          {/* Under the bell: across the screen on phones, a panel on the right on computers. */}
          <div
            role="dialog"
            aria-label="Notifications"
            className="fixed inset-x-2 top-16 z-50 max-h-[75dvh] overflow-y-auto rounded-xl border bg-background shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
          >
          <div className="flex items-start justify-between gap-2 border-b p-4">
            <div>
              <p className="font-semibold text-branding">Notifications</p>
              <p className="text-xs text-neutral-600">What needs your attention, and the Admin's recent decisions.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Close" onClick={() => setIsOpen(false)}>
              <X />
            </Button>
          </div>
          <div className="p-4">
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
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
