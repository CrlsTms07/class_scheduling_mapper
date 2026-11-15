import React from "react";
import { UserCheck } from "lucide-react";
import { useActivateTeachers } from "@/api/users";
import { apiErrorMessage } from "@/lib/forms";
import type { User } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Every sign-up still waiting, with a checkbox each: many teachers can be activated in one go.
 * A Chairperson, Master Teacher or Admin is still activated one by one, with "Manage".
 */
const PendingSignUps = ({ users, onManage }: { users: User[]; onManage: (user: User) => void }) => {
  const activate = useActivateTeachers();
  const [chosen, setChosen] = React.useState<number[]>([]);
  const [isConfirmingAll, setIsConfirmingAll] = React.useState(false);
  const isAllChosen = users.length > 0 && chosen.length === users.length;

  if (users.length === 0) return null;

  const toggle = (id: number) => setChosen((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));

  return (
    <section aria-label="Sign-ups waiting" className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
      <div className="space-y-1">
        <h2 className="font-semibold text-neutral-900">
          {users.length} {users.length === 1 ? "sign-up is" : "sign-ups are"} waiting
        </h2>
        <p className="text-sm text-neutral-700">
          Check the teachers you know, then activate them together as Teacher (read-only: their own schedule and
          profile). Use Manage for a Chairperson, Master Teacher or Admin.
        </p>
      </div>

      {activate.isError && <FormAlert>{apiErrorMessage(activate.error)}</FormAlert>}
      {activate.isSuccess && <FormAlert variant="success">{activate.data.message}</FormAlert>}

      {isConfirmingAll ? (
        <div className="space-y-2 rounded-lg border border-[#790D16]/30 bg-background p-3">
          <p className="text-sm text-neutral-800">
            Approve all {users.length} {users.length === 1 ? "sign-up" : "sign-ups"} as Teacher? They can sign in right away and
            see only their own schedule and profile. You can still change anyone's access later with Manage.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="outline" className="h-11" onClick={() => setIsConfirmingAll(false)}>
              Not now
            </Button>
            <Button
              type="button"
              className="h-11"
              disabled={activate.isPending}
              onClick={() =>
                activate.mutate(
                  users.map(({ id }) => id),
                  { onSuccess: () => { setChosen([]); setIsConfirmingAll(false); } },
                )
              }
            >
              {activate.isPending ? "Approving..." : `Yes, approve all ${users.length}`}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" className="h-11 w-full sm:w-auto" onClick={() => setIsConfirmingAll(true)}>
          <UserCheck />
          Approve all ({users.length}) as Teacher
        </Button>
      )}

      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-sm font-medium">
        <Checkbox checked={isAllChosen} onCheckedChange={() => setChosen(isAllChosen ? [] : users.map(({ id }) => id))} />
        Select all
      </label>

      <ul className="divide-y rounded-lg border bg-background">
        {users.map((user) => (
          <li key={user.id} className="flex flex-wrap items-center gap-3 p-3">
            <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
              <Checkbox
                aria-label={`Choose ${user.first_name} ${user.last_name}`}
                checked={chosen.includes(user.id)}
                onCheckedChange={() => toggle(user.id)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-neutral-900">
                  {user.first_name} {user.last_name}
                </span>
                <span className="block truncate text-xs text-neutral-600">{user.email}</span>
              </span>
            </label>
            {user.matching_personnel ? (
              <Badge className="bg-emerald-100 text-emerald-900">On the teachers list</Badge>
            ) : (
              <Badge variant="secondary">Not on the teachers list</Badge>
            )}
            <Button type="button" variant="outline" className="h-11" onClick={() => onManage(user)}>
              Manage
            </Button>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full sm:w-auto"
        disabled={chosen.length === 0 || activate.isPending}
        onClick={() => activate.mutate(chosen, { onSuccess: () => setChosen([]) })}
      >
        <UserCheck />
        {activate.isPending
          ? "Activating..."
          : chosen.length > 0
            ? `Activate ${chosen.length} selected as Teacher`
            : "Activate selected as Teacher"}
      </Button>
    </section>
  );
};

export default PendingSignUps;
