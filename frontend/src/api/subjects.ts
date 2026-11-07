import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
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
