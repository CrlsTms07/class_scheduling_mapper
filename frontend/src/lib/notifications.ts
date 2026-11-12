import type { AppNotification } from "@/types/api";

/** New since the user last opened the list. Never opened means all of them are new. */
export function unreadCount(items: AppNotification[], seenAt: string | null): number {
  if (!seenAt) return items.length;

  const seen = new Date(seenAt).getTime();

  return items.filter(({ at }) => new Date(at).getTime() > seen).length;
}
