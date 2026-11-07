import { useQuery } from "@tanstack/react-query";
import type { AdminDashboard, DataResponse } from "@/types/api";
import { api } from "./client";

export function useAdminDashboard(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "dashboard"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<AdminDashboard>>(`/terms/${termId}/dashboard`)).data,
  });
}
