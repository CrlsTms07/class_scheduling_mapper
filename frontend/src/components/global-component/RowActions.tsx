import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type RowActionsProp = {
  /** What the row is, for the screen-reader labels ("Edit Grade 7 – Honesty"). */
  name: string;
  onView: () => void;
  /** Left out when the user may only look. */
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
};

/** View, Edit and Delete for one row of a list. Every button is at least 44 px. */
const RowActions = ({ name, onView, onEdit, onDelete, className = "" }: RowActionsProp) => (
  <div className={`flex items-center justify-end gap-1 ${className}`}>
    <Button type="button" variant="ghost" size="icon" className="size-11 text-neutral-700 hover:text-branding" aria-label={`View ${name}`} title="View" onClick={onView}>
      <Eye />
    </Button>
    {onEdit && (
      <Button type="button" variant="ghost" size="icon" className="size-11 text-neutral-700 hover:text-branding" aria-label={`Edit ${name}`} title="Edit" onClick={onEdit}>
        <Pencil />
      </Button>
    )}
    {onDelete && (
      <Button type="button" variant="ghost" size="icon" className="size-11 text-neutral-700 hover:bg-red-50 hover:text-destructive" aria-label={`Delete ${name}`} title="Delete" onClick={onDelete}>
        <Trash2 />
      </Button>
    )}
  </div>
);

export default RowActions;
