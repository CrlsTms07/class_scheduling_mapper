import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ConflictDetails,
  DataResponse,
  Plotter,
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

export function useClearSlot(termId: number | undefined, sectionId: number) {
  return useSlotChange<{ slotId: number; days: number[] }>(
    termId,
    sectionId,
    ({ slotId, days }, basePath) =>
      api(`${basePath}/${slotId}`, { method: "DELETE", body: { days } }),
  );
}

/** The conflicts and suggestions in an API error, if it is a schedule conflict. */
export function conflictDetailsOf(error: unknown): ConflictDetails | null {
  return error instanceof ApiError && error.code === "schedule_conflict"
    ? (error.body as ConflictDetails)
    : null;
}
