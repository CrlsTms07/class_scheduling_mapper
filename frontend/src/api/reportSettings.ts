import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DataResponse,
  DocumentSetting,
  ReportSettings,
  SchoolProfile,
  Signatory,
  SignatoryInput,
} from "@/types/api";
import { api } from "./client";

const SETTINGS_KEY = ["report-settings"];

export function useReportSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => (await api<DataResponse<ReportSettings>>("/report-settings")).data,
  });
}

function useSettingsChange<Input>(send: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: send,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export const useSaveProfile = () =>
  useSettingsChange((body: SchoolProfile) => api("/school-profile", { method: "PUT", body }));

export const useAddLogo = () =>
  useSettingsChange((file: File) => {
    const body = new FormData();
    body.append("logo", file);
    return api("/school-profile/logos", { method: "POST", body });
  });

/** The campus photo on the landing page. The landing page reads it fresh after a change. */
export const useSavePhoto = () => {
  const queryClient = useQueryClient();
  return useSettingsChange(async (file: File) => {
    const body = new FormData();
    body.append("photo", file);
    await api("/school-profile/photo", { method: "POST", body });
    await queryClient.invalidateQueries({ queryKey: ["public", "school"] });
  });
};

export const useRemovePhoto = () => {
  const queryClient = useQueryClient();
  return useSettingsChange(async () => {
    await api("/school-profile/photo", { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["public", "school"] });
  });
};

export const useRemoveLogo = () =>
  useSettingsChange((index: number) => api(`/school-profile/logos/${index}`, { method: "DELETE" }));

/** Prints a logo at the top of the form (like the DepEd seal) or in its footer. */
export const useSetLogoPlacement = () =>
  useSettingsChange(({ index, placement }: { index: number; placement: "header" | "footer" }) =>
    api(`/school-profile/logos/${index}/placement`, { method: "PUT", body: { placement } }),
  );

export const useSaveDocument = () =>
  useSettingsChange((body: DocumentSetting) =>
    api("/report-settings/documents", { method: "PUT", body }),
  );

const signatoriesKey = (termId: number | undefined) => ["terms", termId, "signatories"];

export function useSignatories(termId: number | undefined) {
  return useQuery({
    queryKey: signatoriesKey(termId),
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<Signatory[]>>(`/terms/${termId}/signatories`)).data,
  });
}

/** Copying changes other terms too, so this refreshes every term's list. */
function useSignatoryChange<Input, Output = unknown>(send: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: send,
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) => queryKey[0] === "terms" && queryKey[2] === "signatories",
      }),
  });
}

export const useAddSignatory = (termId: number) =>
  useSignatoryChange((body: SignatoryInput) =>
    api(`/terms/${termId}/signatories`, { method: "POST", body }),
  );

export const useUpdateSignatory = (signatoryId: number) =>
  useSignatoryChange((body: SignatoryInput) =>
    api(`/signatories/${signatoryId}`, { method: "PUT", body }),
  );

export const useDeleteSignatory = (signatoryId: number) =>
  useSignatoryChange(() => api(`/signatories/${signatoryId}`, { method: "DELETE" }));

export const useMoveSignatory = () =>
  useSignatoryChange(({ id, direction }: { id: number; direction: "up" | "down" }) =>
    api(`/signatories/${id}/move`, { method: "POST", body: { direction } }),
  );

export const useCopySignatories = (termId: number) =>
  useSignatoryChange(() =>
    api<DataResponse<{ terms: number }>>(`/terms/${termId}/signatories/copy`, { method: "POST" }),
  );
