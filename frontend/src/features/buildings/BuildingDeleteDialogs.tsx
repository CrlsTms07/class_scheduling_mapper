import { useDeleteBuilding, useDeleteRoom } from "@/api/buildings";
import type { ManagedBuilding, ManagedRoom } from "@/types/api";
import DeleteDialog from "@/components/global-component/DeleteDialog";

/** Deletes a building from the list, after asking. A building with rooms says to remove them first. */
export const BuildingDeleteDialog = ({ building, onClose }: { building: ManagedBuilding; onClose: () => void }) => {
  const remove = useDeleteBuilding(building.id);

  return (
    <DeleteDialog
      name={building.name}
      blockedReason={building.rooms.length > 0 ? "Remove its rooms first." : null}
      isPending={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
};

/** Deletes a room from the list, after asking. A room in use by a schedule or section says why it stays. */
export const RoomDeleteDialog = ({ room, buildingName, onClose }: { room: ManagedRoom; buildingName: string; onClose: () => void }) => {
  const remove = useDeleteRoom(room.id);

  return (
    <DeleteDialog
      name={`Room ${room.room_number} of ${buildingName}`}
      blockedReason={room.cannot_delete_reason}
      isPending={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
};
