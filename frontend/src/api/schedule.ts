import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActivityPlacement, ActivityScope, AutoFillPlan, ScheduleImportResult, ConflictDetails, CopyScheduleResult, DataResponse, Plotter, RoomSchedule, ScheduleMap, SectionSummary } from "@/types/api";
import { api, ApiError } from "./client";

export function useSections(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "sections"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<SectionSummary[]>>(`/terms/${termId}/sections`)).data,
  });
}

/** Starts a section's schedule over. Its teacher loading stays. */
export function useClearSchedule(termId: number, sectionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api(`/terms/${termId}/sections/${sectionId}/schedule`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["terms", termId] }),
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

export type PlaceActivityInput = {
  slotId: number;
  activity_id: number;
  scope: ActivityScope;
  days: number[];
  preview: boolean;
};

/**
 * Puts an activity on one section, its grade level, or all sections. With preview, the reply
 * only says what would happen. Otherwise other sections changed too, so their screens refresh.
 */
export function usePlaceActivity(termId: number | undefined, sectionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slotId, ...body }: PlaceActivityInput) =>
      api<{ summary: ActivityPlacement; data: Plotter | null }>(
        `/terms/${termId}/sections/${sectionId}/slots/${slotId}/activity`,
        { method: "POST", body },
      ),
    onSuccess: ({ data }) => {
      if (!data) return;
      queryClient.setQueryData(plotterKey(termId, sectionId), data);
      queryClient.invalidateQueries({
        queryKey: ["terms", termId],
        predicate: ({ queryKey }) => !(queryKey[2] === "sections" && queryKey[3] === sectionId && queryKey[4] === "plotter"),
      });
    },
  });
}

/** Auto-fill: a preview first, then Confirm with the plan that was previewed. */
export function useAutoFill(termId: number | undefined, sectionId: number) {
  const queryClient = useQueryClient();
  const base = `/terms/${termId}/sections/${sectionId}/auto-fill`;

  const preview = useMutation({
    mutationFn: async (scope: ActivityScope) =>
      (await api<DataResponse<AutoFillPlan>>(`${base}/preview`, { method: "POST", body: { scope } })).data,
  });

  const confirm = useMutation({
    mutationFn: (body: { scope: ActivityScope; plan_hash: string }) =>
      api<{ summary: AutoFillPlan; data: Plotter }>(base, { method: "POST", body }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(plotterKey(termId, sectionId), data);
      queryClient.invalidateQueries({
        queryKey: ["terms", termId],
        predicate: ({ queryKey }) => !(queryKey[2] === "sections" && queryKey[3] === sectionId && queryKey[4] === "plotter"),
      });
    },
  });

  const undo = useMutation({
    mutationFn: (runId: number) =>
      api<{ summary: { removed: number; kept_locked: number }; data: Plotter }>(`${base}/${runId}`, { method: "DELETE" }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(plotterKey(termId, sectionId), data);
      queryClient.invalidateQueries({
        queryKey: ["terms", termId],
        predicate: ({ queryKey }) => !(queryKey[2] === "sections" && queryKey[3] === sectionId && queryKey[4] === "plotter"),
      });
    },
  });

  return { preview, confirm, undo };
}

/** Import a schedule from the template file. With preview, the rows are only checked. */
export function useImportSchedule(termId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, preview, setUp = false }: { file: File; preview: boolean; setUp?: boolean }) => {
      const body = new FormData();
      body.append("file", file);
      body.append("preview", preview ? "1" : "0");
      body.append("set_up", setUp ? "1" : "0");
      return api<DataResponse<ScheduleImportResult>>(`/terms/${termId}/schedule-import`, { method: "POST", body });
    },
    onSuccess: (_data, { preview, setUp }) => {
      // A set-up also adds sections, subjects, teachers, rooms and a bell schedule.
      if (!preview) queryClient.invalidateQueries(setUp ? undefined : { queryKey: ["terms", termId] });
    },
  });
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
