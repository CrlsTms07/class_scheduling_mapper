import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApprovalSection, DataResponse, ReviewInput } from "@/types/api";
import { api } from "./client";

export function useApprovals(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "approvals"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<ApprovalSection[]>>(`/terms/${termId}/approvals`)).data,
  });
}

export function useReviewSchedules(termId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReviewInput) =>
      api<DataResponse<{ entries: number; sections: number }>>(
        `/terms/${termId}/approvals`,
        { method: "POST", body: input },
      ),
    // Statuses changed in the section list and every open plotter of this term.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["terms", termId] }),
  });
}
