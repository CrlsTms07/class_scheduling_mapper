import React from "react";
import { Pencil, Plus } from "lucide-react";
import { useActivities, useCreateActivity, useDeleteActivity, useUpdateActivity } from "@/api/subjects";
import { apiErrorMessage } from "@/lib/forms";
import type { Activity } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ActivitiesSectionProp = {
  yearId: number;
  canManage: boolean;
};

/**
 * Activities such as Flag Ceremony or Catch-up Friday. They take a period on the schedule
 * like a subject, but have no teacher, room or minutes. Recess and lunch are breaks in Time Slots.
 */
const ActivitiesSection = ({ yearId, canManage }: ActivitiesSectionProp) => {
  const { data: activities, isPending, isError } = useActivities(yearId);
  // undefined: no form open. null: adding a new one.
  const [editing, setEditing] = React.useState<Activity | null | undefined>(undefined);

  return (
    <section aria-labelledby="activities-heading" className="space-y-3 rounded-md border p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p id="activities-heading" className="font-medium text-teal-700">
            Activities
          </p>
          <p className="text-xs text-neutral-700">
            Flag Ceremony, Catch-up Friday and the like. In the plotter, choose Activity on a period, then apply it to one
            section, a whole grade level or all sections.
          </p>
        </div>
        {canManage && editing === undefined && (
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={() => setEditing(null)}>
            <Plus />
            Add activity
          </Button>
        )}
      </div>

      {editing !== undefined && (
        <ActivityEditor
          key={editing?.id ?? "new"}
          yearId={yearId}
          activity={editing}
          onDone={() => setEditing(undefined)}
        />
      )}

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the activities.</p>}
      {activities?.length === 0 && <p className="text-sm text-neutral-700">No activities yet.</p>}

      <ul className="flex flex-wrap gap-2">
        {activities?.map((activity) => (
          <li key={activity.id} className="flex min-h-11 items-center gap-2 rounded-md border bg-slate-100 pl-3 pr-1 text-sm">
            <span className="font-medium text-slate-900">{activity.name}</span>
            {activity.code && <Badge variant="secondary">{activity.code}</Badge>}
            {canManage && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={`Edit ${activity.name}`}
                onClick={() => setEditing(activity)}
              >
                <Pencil />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

type ActivityEditorProp = {
  yearId: number;
  activity: Activity | null;
  onDone: () => void;
};

const ActivityEditor = ({ yearId, activity, onDone }: ActivityEditorProp) => {
  const create = useCreateActivity(yearId);
  const update = useUpdateActivity(activity?.id ?? 0);
  const remove = useDeleteActivity(activity?.id ?? 0);
  const [name, setName] = React.useState(activity?.name ?? "");
  const [code, setCode] = React.useState(activity?.code ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const save = activity ? update : create;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (name.trim() === "") {
      setError("Enter the name of the activity.");
      return;
    }

    save.mutate(
      { name: name.trim(), code: code.trim() || null },
      { onSuccess: onDone, onError: (problem) => setError(apiErrorMessage(problem)) },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border bg-neutral-50 p-3">
      {error && <FormAlert>{error}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="space-y-1">
          <label htmlFor="activity-name" className="text-sm text-neutral-800">
            Name
          </label>
          <Input
            id="activity-name"
            className="h-11"
            placeholder="Flag Ceremony"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="activity-code" className="text-sm text-neutral-800">
            Code (optional)
          </label>
          <Input id="activity-code" className="h-11" value={code} onChange={(event) => setCode(event.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="h-11" disabled={save.isPending}>
          {save.isPending ? "Saving..." : activity ? "Save changes" : "Add activity"}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {activity && (
        <ConfirmDelete
          label={`Delete ${activity.name}`}
          blockedReason={activity.in_use ? "It is on a schedule. Remove it there first." : null}
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(undefined, { onSuccess: onDone, onError: (problem) => setError(apiErrorMessage(problem)) })}
        />
      )}
    </form>
  );
};

export default ActivitiesSection;
