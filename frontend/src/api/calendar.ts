import { useQuery } from "@tanstack/react-query";
import type { ActiveTerm, DataResponse } from "@/types/api";
import { api } from "./client";

/** The active term, or null when the Admin has not set one. */
export function useActiveTerm() {
  return useQuery({
    queryKey: ["active-term"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      (await api<DataResponse<ActiveTerm | null>>("/active-term")).data,
  });
}
