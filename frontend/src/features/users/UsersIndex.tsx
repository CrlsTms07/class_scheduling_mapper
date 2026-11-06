import React from "react";
import { useMe } from "@/api/auth";
import { useUsers } from "@/api/users";
import { ROLE_LABELS } from "@/lib/navigation";
import type { User } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ActivationSheet from "./ActivationSheet";

const STATUS_COLORS: Record<User["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  active: "bg-emerald-100 text-emerald-900",
  inactive: "bg-neutral-200 text-neutral-800",
};

// The simple version: pending sign-ups and activation. The full Users screen comes later.
const UsersIndex = () => {
  const { data: me } = useMe();
  const { data: users, isPending, isError } = useUsers();
  const [selected, setSelected] = React.useState<User | null>(null);

  const pendingCount = users?.filter(({ status }) => status === "pending").length ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <p className="text-branding text-xl font-medium">Users</p>
        <p className="text-sm text-neutral-700">
          {pendingCount > 0
            ? `${pendingCount} ${pendingCount === 1 ? "account is" : "accounts are"} waiting for activation.`
            : "Activate new accounts and set each user's role and grade levels."}
        </p>
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the accounts.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {users?.map((user) => (
          <Card key={user.id} className="shadow shadow-[#790D16]/40">
            <CardContent className="space-y-2">
              <p className="font-bold text-sm">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-neutral-700 break-all">{user.email}</p>
              <div className="flex flex-wrap gap-2">
                <Badge className={STATUS_COLORS[user.status]}>{user.status}</Badge>
                {user.role && (
                  <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                )}
              </div>
              {user.grade_levels.length > 0 && (
                <p className="text-xs text-neutral-700">
                  Grade {user.grade_levels.map(({ grade }) => grade).join(", ")}
                </p>
              )}
              {user.id !== me?.id && (
                <Button
                  type="button"
                  variant={user.status === "pending" ? "default" : "outline"}
                  className="h-11 w-full"
                  onClick={() => setSelected(user)}
                >
                  {user.status === "pending" ? "Activate" : "Change access"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selected && (
        <ActivationSheet
          key={selected.id}
          user={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default UsersIndex;
