import { useQuery } from "@tanstack/react-query";
import type { DataResponse, ReportGrid, ReportOptions, RoomUsage, ValidationReportData } from "@/types/api";
import { api } from "./client";

export function useReportOptions(termId: number | undefined) {
  return useQuery({
    queryKey: ["terms", termId, "report-options"],
    enabled: termId !== undefined,
    queryFn: async () =>
      (await api<DataResponse<ReportOptions>>(`/terms/${termId}/reports/options`)).data,
  });
}

export function useReportGrid(termId: number | undefined, path: string | null) {
  return useQuery({
    queryKey: ["terms", termId, "report", path],
    enabled: termId !== undefined && path !== null,
    queryFn: async () =>
      (await api<DataResponse<ReportGrid>>(`/terms/${termId}/reports/${path}`)).data,
  });
}

export function useValidationReport(termId: number) {
  return useQuery({
    queryKey: ["terms", termId, "validation-report"],
    queryFn: async () =>
      (await api<DataResponse<ValidationReportData>>(`/terms/${termId}/reports/validation`)).data,
  });
}

export function useRoomUsage(termId: number | undefined, isEnabled: boolean) {
  return useQuery({
    queryKey: ["terms", termId, "room-usage"],
    enabled: termId !== undefined && isEnabled,
    queryFn: async () =>
      (await api<DataResponse<RoomUsage>>(`/terms/${termId}/reports/room-usage`)).data,
  });
}
