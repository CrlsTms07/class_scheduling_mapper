import { useQuery } from "@tanstack/react-query";
import type { DataResponse, GuestSection, GuestSectionList } from "@/types/api";
import { api } from "./client";

export function useGuestSections() {
  return useQuery({
    queryKey: ["guest", "sections"],
    queryFn: async () => (await api<DataResponse<GuestSectionList>>("/guest/sections")).data,
  });
}

export function useGuestSection(sectionId: number) {
  return useQuery({
    queryKey: ["guest", "sections", sectionId],
    retry: false,
    queryFn: async () => (await api<DataResponse<GuestSection>>(`/guest/sections/${sectionId}`)).data,
  });
}
