import { useQuery } from "@tanstack/react-query";
import type { DataResponse, MyProfile, MySchedule } from "@/types/api";
import { api } from "./client";

export function useMySchedule(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "my-schedule"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<MySchedule | null>>(`/terms/${termId}/my-schedule`)).data,
  });
}

export function useMyProfile(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "my-profile"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<MyProfile | null>>(`/terms/${termId}/my-profile`)).data,
  });
}
