import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DataResponse,
  ManagedTeacher,
  NamedOption,
  PersonnelOptions,
  PersonnelOptionType,
  TeacherInput,
} from "@/types/api";
import { api } from "./client";

export function useTeachers(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "teachers"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<ManagedTeacher[]>>(`/terms/${termId}/teachers`)).data,
  });
}

export function usePersonnelOptions() {
  return useQuery({
    queryKey: ["personnel-options"],
    queryFn: async () => (await api<DataResponse<PersonnelOptions>>("/personnel-options")).data,
  });
}

/** Teachers also appear in the Sections form and the plotter, so those refresh too. */
function useTeacherChange<Input, Output = unknown>(send: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terms"] });
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      queryClient.invalidateQueries({ queryKey: ["personnel-options"] });
    },
  });
}

export const useCreateTeacher = (termId: number) =>
  useTeacherChange((body: TeacherInput) =>
    api(`/terms/${termId}/teachers`, { method: "POST", body }),
  );

export const useUpdateTeacher = (termId: number, teacherId: number) =>
  useTeacherChange((body: TeacherInput) =>
    api(`/terms/${termId}/teachers/${teacherId}`, { method: "PUT", body }),
  );

export const useDeleteTeacher = (teacherId: number) =>
  useTeacherChange(() => api(`/teachers/${teacherId}`, { method: "DELETE" }));

export const useAddPersonnelOption = (type: PersonnelOptionType) =>
  useTeacherChange((name: string) =>
    api<DataResponse<NamedOption>>(`/personnel-options/${type}`, {
      method: "POST",
      body: { name },
    }),
  );
