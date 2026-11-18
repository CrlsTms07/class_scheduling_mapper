import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DataResponse, ManagedBuilding, RoomInput, SchoolLevel } from "@/types/api";
import { api } from "./client";

export function useBuildings() {
  return useQuery({
    queryKey: ["buildings"],
    queryFn: async () => (await api<DataResponse<ManagedBuilding[]>>("/buildings")).data,
  });
}

/** Rooms also appear in the Sections form and the plotter, so those refresh too. */
function useBuildingChange<Input>(send: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buildings"] });
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      queryClient.invalidateQueries({ queryKey: ["terms"] });
    },
  });
}

/** The department is sent only by the Admin; a scheduler's building is their own department's. */
export type BuildingInput = { name: string; department?: SchoolLevel | null };

export const useCreateBuilding = () =>
  useBuildingChange((body: BuildingInput) => api("/buildings", { method: "POST", body }));

export const useRenameBuilding = (buildingId: number) =>
  useBuildingChange((body: BuildingInput) =>
    api(`/buildings/${buildingId}`, { method: "PUT", body }),
  );

export const useDeleteBuilding = (buildingId: number) =>
  useBuildingChange(() => api(`/buildings/${buildingId}`, { method: "DELETE" }));

export const useAddRoom = (buildingId: number) =>
  useBuildingChange((body: RoomInput) =>
    api(`/buildings/${buildingId}/rooms`, { method: "POST", body }),
  );

export const useUpdateRoom = (roomId: number) =>
  useBuildingChange((body: RoomInput) => api(`/rooms/${roomId}`, { method: "PUT", body }));

export const useDeleteRoom = (roomId: number) =>
  useBuildingChange(() => api(`/rooms/${roomId}`, { method: "DELETE" }));
