import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Activity,
  DataResponse,
  ManagedSubject,
  SubjectInput,
  SubjectOptions,
} from "@/types/api";
import { api } from "./client";

export function useSubjects(yearId: number | undefined) {
  return useQuery({
    queryKey: ["school-years", yearId, "subjects"],
    enabled: yearId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<ManagedSubject[]>>(`/school-years/${yearId}/subjects`)).data,
  });
}

export function useSubjectOptions(yearId: number | undefined) {
  return useQuery({
    queryKey: ["school-years", yearId, "subject-options"],
    enabled: yearId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<SubjectOptions>>(`/school-years/${yearId}/subject-options`)).data,
  });
}

/** Subjects also appear in the school year's counts and in the plotter, so those refresh too. */
function useSubjectChange<Input>(send: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      queryClient.invalidateQueries({ queryKey: ["terms"] });
    },
  });
}

export const useCreateSubject = (yearId: number) =>
  useSubjectChange((body: SubjectInput) =>
    api(`/school-years/${yearId}/subjects`, { method: "POST", body }),
  );

export const useUpdateSubject = (subjectId: number) =>
  useSubjectChange((body: SubjectInput) => api(`/subjects/${subjectId}`, { method: "PUT", body }));

export const useDeleteSubject = (subjectId: number) =>
  useSubjectChange(() => api(`/subjects/${subjectId}`, { method: "DELETE" }));

export function useActivities(yearId: number | undefined) {
  return useQuery({
    queryKey: ["school-years", yearId, "activities"],
    enabled: yearId !== undefined,
    queryFn: async () => (await api<DataResponse<Activity[]>>(`/school-years/${yearId}/activities`)).data,
  });
}

export const useCreateActivity = (yearId: number) =>
  useSubjectChange((body: { code: string | null; name: string }) =>
    api(`/school-years/${yearId}/activities`, { method: "POST", body }),
  );

export const useUpdateActivity = (activityId: number) =>
  useSubjectChange((body: { code: string | null; name: string }) =>
    api(`/activities/${activityId}`, { method: "PUT", body }),
  );

export const useDeleteActivity = (activityId: number) =>
  useSubjectChange(() => api(`/activities/${activityId}`, { method: "DELETE" }));
