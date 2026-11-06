import { useQuery } from "@tanstack/react-query";
import type { DataResponse, Term } from "@/types/api";
import { api } from "./client";

/** Every term, newest school year first. */
export function useTerms() {
  return useQuery({
    queryKey: ["terms"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => (await api<DataResponse<Term[]>>("/terms")).data,
  });
}
