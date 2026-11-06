import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DataResponse,
  ManagedSection,
  SectionInput,
  SectionOptions,
  Track,
} from "@/types/api";
import { api } from "./client";

export function useManagedSections(yearId: number | undefined) {
  return useQuery({
    queryKey: ["school-years", yearId, "sections"],
    enabled: yearId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<ManagedSection[]>>(`/school-years/${yearId}/sections`)).data,
  });
}

export function useSectionOptions(yearId: number | undefined) {
  return useQuery({
    queryKey: ["school-years", yearId, "section-options"],
    enabled: yearId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<SectionOptions>>(`/school-years/${yearId}/section-options`)).data,
  });
}

/**
 * A change here also affects the school year's counts and the section lists of each term,
 * which is why both are refreshed.
 */
function useSectionChange<Input, Output = unknown>(send: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      queryClient.invalidateQueries({ queryKey: ["terms"] });
    },
  });
}

export const useCreateSection = (yearId: number) =>
  useSectionChange((body: SectionInput) =>
    api(`/school-years/${yearId}/sections`, { method: "POST", body }),
  );

export const useUpdateSection = (sectionId: number) =>
  useSectionChange((body: SectionInput) => api(`/sections/${sectionId}`, { method: "PUT", body }));

export const useDeleteSection = (sectionId: number) =>
  useSectionChange(() => api(`/sections/${sectionId}`, { method: "DELETE" }));

export const useAddTrack = () =>
  useSectionChange((name: string) =>
    api<DataResponse<Track>>("/tracks", { method: "POST", body: { name } }),
  );
