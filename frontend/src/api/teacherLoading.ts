import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CopyLoadingResult, DataResponse, NamedOption, SectionLoading } from "@/types/api";
import { api } from "./client";

const loadingKey = (termId: number | undefined, sectionId: number | undefined) => [
  "terms",
  termId,
  "sections",
  sectionId,
  "loading",
];

export function useSectionLoading(termId: number | undefined, sectionId: number | undefined) {
  return useQuery({
    queryKey: loadingKey(termId, sectionId),
    enabled: termId !== undefined && sectionId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<SectionLoading>>(`/terms/${termId}/sections/${sectionId}/loading`)).data,
  });
}

/** The reply has the updated list. The plotter and teacher counts of the term also change. */
function useLoadingChange<Input>(
  termId: number,
  sectionId: number,
  send: (input: Input) => Promise<DataResponse<SectionLoading>>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: send,
    onSuccess: ({ data }) => {
      queryClient.setQueryData(loadingKey(termId, sectionId), data);
      queryClient.invalidateQueries({
        queryKey: ["terms", termId],
        predicate: ({ queryKey }) => queryKey[4] !== "loading",
      });
    },
  });
}

export const useAssignLoading = (termId: number, sectionId: number, subjectId: number) =>
  useLoadingChange(termId, sectionId, (teacherId: number) =>
    api(`/terms/${termId}/sections/${sectionId}/loading/${subjectId}`, {
      method: "PUT",
      body: { teacher_id: teacherId },
    }),
  );

export const useRemoveLoading = (termId: number, sectionId: number, subjectId: number) =>
  useLoadingChange(termId, sectionId, () =>
    api(`/terms/${termId}/sections/${sectionId}/loading/${subjectId}`, { method: "DELETE" }),
  );

/** Changes who teaches a subject of a section. Its plotted periods follow the new teacher. */
export const useChangeTeacher = (termId: number, sectionId: number) =>
  useLoadingChange(termId, sectionId, ({ subjectId, teacherId }: { subjectId: number; teacherId: number }) =>
    api(`/terms/${termId}/sections/${sectionId}/loading/${subjectId}`, {
      method: "PUT",
      body: { teacher_id: teacherId },
    }),
  );

export function useCopyLoading(termId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { from_term_id: number; section_id: number | null }) =>
      api<DataResponse<CopyLoadingResult>>(`/terms/${termId}/loading/copy`, { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["terms", termId] }),
  });
}

export function useQuickAddTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { first_name: string; last_name: string }) =>
      api<DataResponse<NamedOption>>("/teachers/quick-add", { method: "POST", body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey[0] === "terms" && queryKey[2] === "teachers",
      });
    },
  });
}
