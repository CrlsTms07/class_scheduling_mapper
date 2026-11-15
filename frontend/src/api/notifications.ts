import { useQuery } from "@tanstack/react-query";
import type { AppNotification, DataResponse } from "@/types/api";
import { api } from "./client";

/** Checked again every minute while the app is open, and whenever the user comes back to it. */
export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    refetchInterval: 60_000,
    queryFn: async () => (await api<DataResponse<AppNotification[]>>("/notifications")).data,
  });
}
