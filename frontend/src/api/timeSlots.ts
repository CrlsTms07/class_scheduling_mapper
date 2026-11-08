import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DataResponse, ManagedPattern, PatternInput, SlotInput } from "@/types/api";
import { api } from "./client";

export function useDayPatterns(yearId: number | undefined) {
  return useQuery({
    queryKey: ["school-years", yearId, "day-patterns"],
    enabled: yearId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<ManagedPattern[]>>(`/school-years/${yearId}/day-patterns`)).data,
  });
}

/**
 * Any change here also changes the school year's counts and every open plotter,
 * which is why both are refreshed.
 */
function useTimeSlotChange<Input>(send: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      queryClient.invalidateQueries({ queryKey: ["terms"] });
    },
  });
}

export const useCreatePattern = (yearId: number) =>
  useTimeSlotChange((body: PatternInput) =>
    api(`/school-years/${yearId}/day-patterns`, { method: "POST", body }),
  );

export const useUpdatePattern = (patternId: number) =>
  useTimeSlotChange((body: Pick<PatternInput, "name" | "days">) =>
    api(`/day-patterns/${patternId}`, { method: "PUT", body }),
  );

export const useCopyPattern = (patternId: number) =>
  useTimeSlotChange((body: PatternInput) =>
    api(`/day-patterns/${patternId}/copy`, { method: "POST", body }),
  );

export const useDeletePattern = (patternId: number) =>
  useTimeSlotChange(() => api(`/day-patterns/${patternId}`, { method: "DELETE" }));

export const useAddSlot = (patternId: number) =>
  useTimeSlotChange((body: SlotInput) =>
    api(`/day-patterns/${patternId}/slots`, { method: "POST", body }),
  );

/** Fills an empty bell schedule at once, from a preset. */
export const usePresetSlots = (patternId: number) =>
  useTimeSlotChange((slots: SlotInput[]) =>
    api(`/day-patterns/${patternId}/slots/preset`, { method: "POST", body: { slots } }),
  );

export const useUpdateSlot = (slotId: number) =>
  useTimeSlotChange((body: SlotInput) => api(`/time-slots/${slotId}`, { method: "PUT", body }));

export const useDeleteSlot = (slotId: number) =>
  useTimeSlotChange(() => api(`/time-slots/${slotId}`, { method: "DELETE" }));
