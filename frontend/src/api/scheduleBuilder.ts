import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DataResponse, Plotter, TeacherSchedule } from "@/types/api";
import { api } from "./client";

/*
 * Building a schedule from the room, section and teacher pages, where one screen touches
 * several sections. Each change refreshes everything of the term, so every view agrees.
 */

export type PeriodInput = {
  sectionId: number;
  days: number[];
  start_time: string;
  end_time: string;
  is_break?: boolean;
  label?: string | null;
};

/** Refreshes every schedule view of the term, and the bell schedules. */
function useRefreshTerm(termId: number | undefined) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["terms", termId] });
    queryClient.invalidateQueries({ queryKey: ["school-years"] });
  };
}

/** A typed time: the period it matches on each day, or a new period or break of the bell schedule. */
export function useResolvePeriod(termId: number | undefined) {
  const refresh = useRefreshTerm(termId);

  return useMutation({
    mutationFn: ({ sectionId, ...body }: PeriodInput) =>
      api<DataResponse<{ slots: Record<string, number>; plotter: Plotter }>>(`/terms/${termId}/sections/${sectionId}/periods`, {
        method: "POST",
        body,
      }),
    onSuccess: refresh,
  });
}

export type PlaceInput = { sectionId: number; slotId: number; section_subject_id: number; room_id: number; days: number[] };

/** Places a class of any section (the same request as the plotter's). */
export function usePlaceClass(termId: number | undefined) {
  const refresh = useRefreshTerm(termId);

  return useMutation({
    mutationFn: ({ sectionId, slotId, ...body }: PlaceInput) =>
      api<DataResponse<Plotter>>(`/terms/${termId}/sections/${sectionId}/slots/${slotId}`, { method: "PUT", body }),
    onSuccess: refresh,
  });
}

/** Takes a class (or a break's use) off the given days. */
export function useRemoveClass(termId: number | undefined) {
  const refresh = useRefreshTerm(termId);

  return useMutation({
    mutationFn: ({ sectionId, slotId, days }: { sectionId: number; slotId: number; days: number[] }) =>
      api<DataResponse<Plotter>>(`/terms/${termId}/sections/${sectionId}/slots/${slotId}`, { method: "DELETE", body: { days } }),
    onSuccess: refresh,
  });
}

/** "+ Add Section" on a room: the room becomes the section's home or usual room. Null takes it out. */
export function useSetSectionRoom(termId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sectionId, roomId }: { sectionId: number; roomId: number | null }) =>
      api<{ message: string }>(`/sections/${sectionId}/room`, { method: "PUT", body: { room_id: roomId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms", termId] });
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
    },
  });
}

/** One teacher's classes in a term: sections, subjects, and the day, time and room of each class. */
export function useTeacherSchedule(termId: number | undefined, teacherId: number) {
  return useQuery({
    queryKey: ["terms", termId, "teachers", teacherId, "schedule"],
    enabled: termId !== undefined && teacherId > 0,
    queryFn: async () => (await api<DataResponse<TeacherSchedule>>(`/terms/${termId}/teachers/${teacherId}/schedule`)).data,
  });
}
