import { useDeleteSection } from "@/api/sections";
import type { ManagedSection } from "@/types/api";
import DeleteDialog from "@/components/global-component/DeleteDialog";

/** Deletes one section from the list, after asking. A section with work on it says why it stays. */
const SectionDeleteDialog = ({ section, onClose }: { section: ManagedSection; onClose: () => void }) => {
  const remove = useDeleteSection(section.id);

  return (
    <DeleteDialog
      name={section.label}
      blockedReason={section.locked_reason}
      isPending={remove.isPending}
      error={remove.error}
      onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
};

export default SectionDeleteDialog;
