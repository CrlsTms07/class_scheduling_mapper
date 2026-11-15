import { useQuery } from "@tanstack/react-query";
import type { DataResponse, GuestSection, GuestSectionList, PublicSchool } from "@/types/api";
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

/** The school's details for the landing page. They rarely change, so they are kept for an hour. */
export function usePublicSchool() {
  return useQuery({
    queryKey: ["public", "school"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => (await api<DataResponse<PublicSchool>>("/public/school")).data,
  });
}
