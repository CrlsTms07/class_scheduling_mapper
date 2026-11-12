import { useDeleteTeacher } from "@/api/teachers";
import type { ManagedTeacher } from "@/types/api";
import DeleteDialog from "@/components/global-component/DeleteDialog";

/** Deletes one record from the list, after asking. Someone with an advisory or loading says why they stay. */
const TeacherDeleteDialog = ({ teacher, onClose, onDeleted }: { teacher: ManagedTeacher; onClose: () => void; onDeleted?: () => void }) => {
  const remove = useDeleteTeacher(teacher.id);

  return (
    <DeleteDialog
      name={teacher.printed_name}
      blockedReason={teacher.cannot_delete_reason}
      isPending={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onDeleted ?? onClose })}
      onClose={onClose}
    />
  );
};

export default TeacherDeleteDialog;
