import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import {
  useAddRoom,
  useCreateBuilding,
  useDeleteBuilding,
  useDeleteRoom,
  useRenameBuilding,
  useUpdateRoom,
} from "@/api/buildings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { BuildingSchema, RoomSchema, toRoomForm, toRoomInput, type RoomValues } from "@/lib/buildings";
import { apiErrorMessage } from "@/lib/forms";
import type { ManagedBuilding, ManagedRoom } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type BuildingSheetProp = {
  /** The building to edit, or null to add a new one. */
  building: ManagedBuilding | null;
  onClose: () => void;
};

export const BuildingSheet = ({ building, onClose }: BuildingSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const create = useCreateBuilding();
  const rename = useRenameBuilding(building?.id ?? 0);
  const remove = useDeleteBuilding(building?.id ?? 0);
  const save = building ? rename : create;

  const form = useForm<{ name: string }>({
    resolver: zodResolver(BuildingSchema),
    defaultValues: { name: building?.name ?? "" },
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">
            {building ? `Edit ${building.name}` : "Add building"}
          </SheetTitle>
          <SheetDescription>Rooms are added after saving.</SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="space-y-4 px-4 pb-4"
          onSubmit={form.handleSubmit(({ name }) => save.mutate(name, { onSuccess: onClose }))}
        >
          {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
          {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}
          <FormTextField control={form.control} name="name" label="Building name" placeholder="Building 14" />
          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
          {building && (
            <ConfirmDelete
              label="Delete this building"
              blockedReason={building.rooms.length > 0 ? "Remove its rooms first." : null}
              isPending={remove.isPending}
              onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
            />
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};

type RoomSheetProp = {
  building: ManagedBuilding;
  /** The room to edit, or null to add a new one. */
  room: ManagedRoom | null;
  onClose: () => void;
};

export const RoomSheet = ({ building, room, onClose }: RoomSheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const add = useAddRoom(building.id);
  const update = useUpdateRoom(room?.id ?? 0);
  const remove = useDeleteRoom(room?.id ?? 0);
  const save = room ? update : add;

  const form = useForm<RoomValues>({
    resolver: zodResolver(RoomSchema),
    defaultValues: toRoomForm(room),
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">
            {room ? `Edit room ${room.room_number}` : "Add room"}
          </SheetTitle>
          <SheetDescription>{building.name}</SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="space-y-4 px-4 pb-4"
          onSubmit={form.handleSubmit((values) =>
            save.mutate(toRoomInput(values), { onSuccess: onClose }),
          )}
        >
          {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
          {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}
          <div className="grid grid-cols-2 gap-3">
            <FormTextField control={form.control} name="room_number" label="Room number" placeholder="101" />
            <FormTextField control={form.control} name="capacity" label="Capacity (optional)" placeholder="45" />
          </div>
          <FormTextField control={form.control} name="room_name" label="Room name (optional)" placeholder="Science Lab" />
          <FormTextField control={form.control} name="in_charge" label="In charge (optional)" placeholder="Juan Dela Cruz" />
          <Controller
            name="is_active"
            control={form.control}
            render={({ field }) => (
              <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3">
                <Checkbox className="mt-0.5" checked={field.value} onCheckedChange={field.onChange} />
                <span>
                  <span className="block text-sm font-medium text-neutral-900">In use</span>
                  <span className="block text-xs text-neutral-700">
                    A room not in use is no longer offered for new schedules and sections.
                  </span>
                </span>
              </label>
            )}
          />
          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
          {room && (
            <ConfirmDelete
              label="Delete this room"
              blockedReason={room.cannot_delete_reason}
              isPending={remove.isPending}
              onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
            />
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};
