import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminDashboard, DataResponse, ImportResult, SchedulerDashboard } from "@/types/api";
import { api } from "./client";

export function useAdminDashboard(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "dashboard"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<AdminDashboard>>(`/terms/${termId}/dashboard`)).data,
  });
}

export function useSchedulerDashboard(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "my-dashboard"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<SchedulerDashboard>>(`/terms/${termId}/my-dashboard`)).data,
  });
}

/**
 * Import previous data: the teacher loading of an earlier term, for the user's grade levels.
 * With preview, the reply only says what would be copied.
 */
export function useImportPrevious(termId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { from_term_id: number; preview: boolean }) =>
      api<DataResponse<ImportResult>>(`/terms/${termId}/import-previous`, { method: "POST", body }),
    onSuccess: (_data, { preview }) => {
      if (!preview) queryClient.invalidateQueries({ queryKey: ["terms", termId] });
    },
  });
}
