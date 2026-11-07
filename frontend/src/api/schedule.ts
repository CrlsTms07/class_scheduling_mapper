import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ConflictDetails,
  CopyScheduleResult,
  DataResponse,
  Plotter,
  RoomSchedule,
  ScheduleMap,
  SectionSummary,
} from "@/types/api";
import { api, ApiError } from "./client";

export function useSections(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "sections"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<SectionSummary[]>>(`/terms/${termId}/sections`)).data,
  });
}

export type CopyScheduleInput = {
  from_term_id: number;
  section_id: number | null;
  grade: number | null;
  fill_subjects: boolean;
  /** Reports what would happen, without copying anything. */
  preview: boolean;
};

export function useCopySchedule(termId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CopyScheduleInput) =>
      api<DataResponse<CopyScheduleResult>>(`/terms/${termId}/schedule-copy`, { method: "POST", body }),
    onSuccess: (_data, { preview }) => {
      if (!preview) {
        queryClient.invalidateQueries({ queryKey: ["terms", termId] });
      }
    },
  });
}

/** Buildings, their rooms and the sections in them, for the Schedule page. */
export function useScheduleMap(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "schedule-map"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<ScheduleMap>>(`/terms/${termId}/schedule-map`)).data,
  });
}

export function useRoomSchedule(termId: number | undefined, roomId: number) {
  return useQuery({
    queryKey: ["terms", termId, "rooms", roomId, "schedule"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<RoomSchedule>>(`/terms/${termId}/rooms/${roomId}/schedule`)).data,
  });
}

const plotterKey = (termId: number | undefined, sectionId: number) => [
  "terms",
  termId,
  "sections",
  sectionId,
  "plotter",
];

export function usePlotter(termId: number | undefined, sectionId: number) {
  return useQuery({
    queryKey: plotterKey(termId, sectionId),
    enabled: termId !== undefined,
    queryFn: async () =>
      (
        await api<DataResponse<Plotter>>(
          `/terms/${termId}/sections/${sectionId}/plotter`,
        )
      ).data,
  });
}

function useSlotChange<Input>(
  termId: number | undefined,
  sectionId: number,
  send: (input: Input, basePath: string) => Promise<DataResponse<Plotter>>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Input) =>
      send(input, `/terms/${termId}/sections/${sectionId}/slots`),
    onSuccess: ({ data }) => {
      // The reply already has the updated schedule, minutes and flags.
      queryClient.setQueryData(plotterKey(termId, sectionId), data);
      queryClient.invalidateQueries({ queryKey: ["terms", termId, "sections"], exact: true });
    },
  });
}

export type AssignInput = {
  slotId: number;
  section_subject_id: number;
  room_id: number;
  days: number[];
};

export function useAssignSlot(termId: number | undefined, sectionId: number) {
  return useSlotChange<AssignInput>(termId, sectionId, ({ slotId, ...body }, basePath) =>
    api(`${basePath}/${slotId}`, { method: "PUT", body }),
  );
}

export function useMoveEntry(termId: number | undefined, sectionId: number) {
  return useSlotChange<{ slotId: number; from_slot_id: number; from_days: number[]; days: number[] }>(
    termId,
    sectionId,
    ({ slotId, ...body }, basePath) => api(`${basePath}/${slotId}/move`, { method: "POST", body }),
  );
}

export function useClearSlot(termId: number | undefined, sectionId: number) {
  return useSlotChange<{ slotId: number; days: number[] }>(
    termId,
    sectionId,
    ({ slotId, days }, basePath) =>
      api(`${basePath}/${slotId}`, { method: "DELETE", body: { days } }),
  );
}

export function useSubmitSchedule(termId: number | undefined, sectionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { acknowledged_flags: string[]; note?: string }) =>
      api<DataResponse<Plotter>>(`/terms/${termId}/sections/${sectionId}/submit`, {
        method: "POST",
        body: input,
      }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(plotterKey(termId, sectionId), data);
      queryClient.invalidateQueries({ queryKey: ["terms", termId, "sections"], exact: true });
    },
  });
}

export function useReviseSchedule(termId: number | undefined, sectionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api<DataResponse<Plotter> & { removed: string[] }>(
        `/terms/${termId}/sections/${sectionId}/revise`,
        { method: "POST" },
      ),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(plotterKey(termId, sectionId), data);
      queryClient.invalidateQueries({ queryKey: ["terms", termId, "sections"], exact: true });
    },
  });
}

/** The conflicts and suggestions in an API error, if it is a schedule conflict. */
export function conflictDetailsOf(error: unknown): ConflictDetails | null {
  return error instanceof ApiError && error.code === "schedule_conflict"
    ? (error.body as ConflictDetails)
    : null;
}
