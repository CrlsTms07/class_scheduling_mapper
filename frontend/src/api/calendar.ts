import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CopyResult,
  DataResponse,
  SchoolYear,
  SchoolYearInput,
  StartSchoolYearInput,
  Term,
} from "@/types/api";
import { api } from "./client";

/** Every term, newest school year first. */
export function useTerms() {
  return useQuery({
    queryKey: ["terms"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await api<DataResponse<Term[]>>("/terms")).data,
  });
}

/** Every school year with its terms, for the Admin. */
export function useSchoolYears() {
  return useQuery({
    queryKey: ["school-years"],
    queryFn: async () => (await api<DataResponse<SchoolYear[]>>("/school-years")).data,
  });
}

/** School years and the term selector both change when the calendar does. */
function useRefreshCalendar() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["school-years"] });
    queryClient.invalidateQueries({ queryKey: ["terms"] });
  };
}

export function useStartSchoolYear() {
  const refresh = useRefreshCalendar();

  return useMutation({
    mutationFn: (body: StartSchoolYearInput) =>
      api<DataResponse<SchoolYear> & { copied: CopyResult }>("/school-years", {
        method: "POST",
        body,
      }),
    onSuccess: refresh,
  });
}

export function useUpdateSchoolYear(yearId: number) {
  const refresh = useRefreshCalendar();

  return useMutation({
    mutationFn: (body: SchoolYearInput) =>
      api<DataResponse<SchoolYear>>(`/school-years/${yearId}`, { method: "PUT", body }),
    onSuccess: refresh,
  });
}

export function useDeleteSchoolYear(yearId: number) {
  const refresh = useRefreshCalendar();

  return useMutation({
    mutationFn: () => api(`/school-years/${yearId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

export function useActivateTerm() {
  const refresh = useRefreshCalendar();

  return useMutation({
    mutationFn: (termId: number) => api(`/terms/${termId}/activate`, { method: "PUT" }),
    onSuccess: refresh,
  });
}
