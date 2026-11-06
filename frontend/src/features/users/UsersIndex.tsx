import React from "react";
import { Filter, SearchIcon, Trash2, UserGroup } from "lucide-react";
import { useMe } from "@/api/auth";
import { useAccessOptions, useDeleteUser, useUsers } from "@/api/users";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import { ROLE_LABELS } from "@/lib/navigation";
import {
  actionLabel,
  filterUsers,
  fullName,
  scopeLabel,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/users";
import type { RoleName, User } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ActivationSheet from "./ActivationSheet";

const HOW_IT_WORKS = [
  "People sign up with their DepEd email. Their account waits here until you activate it or decline it.",
  "Give each account a role. A Chairperson or Master Teacher also needs the grade levels they schedule.",
  "Link a teacher's account to their personnel record so they can see their own schedule.",
  "Deactivate an account when someone leaves. It signs them out, and it can be brought back later.",
  "Delete is for accounts made by mistake. An account that has worked on schedules can only be deactivated.",
];

type UserRowProp = {
  user: User;
  isMe: boolean;
  onManage: (user: User) => void;
  onDelete: (user: User) => void;
};

const ManageButtons = ({ user, isMe, onManage, onDelete, className }: UserRowProp & { className?: string }) =>
  isMe ? (
    <p className="text-xs text-neutral-600">This is you</p>
  ) : (
    <div className={`flex justify-end gap-2 ${className ?? ""}`}>
      <Button
        type="button"
        variant={user.status === "active" ? "outline" : "default"}
        className="h-11 flex-1 md:flex-none"
        aria-label={`${actionLabel(user.status)}: ${fullName(user)}`}
        onClick={() => onManage(user)}
      >
        {actionLabel(user.status)}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 text-destructive"
        aria-label={`Delete: ${fullName(user)}`}
        onClick={() => onDelete(user)}
      >
        <Trash2 />
        Delete
      </Button>
    </div>
  );

/** Asks before deleting, or explains why this account has to stay. */
const DeleteUserSheet = ({ user, onClose }: { user: User; onClose: () => void }) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const remove = useDeleteUser(user.id);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">Delete {fullName(user)}?</SheetTitle>
          <SheetDescription className="break-all">{user.email}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-4 text-sm text-neutral-800">
          {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}
          {user.cannot_delete_reason ? (
            <FormAlert>{user.cannot_delete_reason}</FormAlert>
          ) : (
            <p>
              This removes the account for good. They will be signed out and cannot sign in, but
              they may sign up again.
              {user.personnel && ` The personnel record of ${user.personnel.name} stays.`}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {!user.cannot_delete_reason && (
              <Button
                type="button"
                variant="destructive"
                className="h-11"
                disabled={remove.isPending}
                onClick={() => remove.mutate(undefined, { onSuccess: onClose })}
              >
                {remove.isPending ? "Deleting..." : "Yes, delete this account"}
              </Button>
            )}
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const UserCard = (prop: UserRowProp) => {
  const { user } = prop;

  return (
    <Card className="shadow shadow-[#790D16]/40">
      <CardContent className="space-y-2">
        <p className="font-bold text-sm">{fullName(user)}</p>
        <p className="text-xs text-neutral-700 break-all">{user.email}</p>
        <div className="flex flex-wrap gap-2">
          <Badge className={STATUS_COLORS[user.status]}>{STATUS_LABELS[user.status]}</Badge>
          {user.role && <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>}
        </div>
        {scopeLabel(user) && <p className="text-xs text-neutral-700">{scopeLabel(user)}</p>}
        {user.personnel && (
          <p className="text-xs text-neutral-700">Personnel: {user.personnel.name}</p>
        )}
        <ManageButtons {...prop} className="w-full" />
      </CardContent>
    </Card>
  );
};

const UsersTable = ({
  users,
  myId,
  onManage,
  onDelete,
}: {
  users: User[];
  myId?: number;
  onManage: (user: User) => void;
  onDelete: (user: User) => void;
}) => (
  <div className="overflow-x-auto rounded-md border">
    <table className="w-full text-left text-sm">
      <thead className="bg-[#790D16]/5 text-xs text-neutral-700">
        <tr>
          <th scope="col" className="p-3 font-medium">Name</th>
          <th scope="col" className="p-3 font-medium">Status</th>
          <th scope="col" className="p-3 font-medium">Role</th>
          <th scope="col" className="p-3 font-medium">Grade levels</th>
          <th scope="col" className="p-3 font-medium">Personnel record</th>
          <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {users.map((user) => (
          <tr key={user.id}>
            <td className="p-3">
              <p className="font-medium text-teal-700">{fullName(user)}</p>
              <p className="text-xs text-neutral-700 break-all">{user.email}</p>
            </td>
            <td className="p-3">
              <Badge className={STATUS_COLORS[user.status]}>{STATUS_LABELS[user.status]}</Badge>
            </td>
            <td className="p-3">{user.role ? ROLE_LABELS[user.role] : "–"}</td>
            <td className="p-3">{scopeLabel(user) || "–"}</td>
            <td className="p-3">{user.personnel?.name ?? "–"}</td>
            <td className="p-2 text-right">
              <ManageButtons user={user} isMe={user.id === myId} onManage={onManage} onDelete={onDelete} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const UsersIndex = () => {
  const { data: me } = useMe();
  const { data: users, isPending, isError } = useUsers();
  useAccessOptions(); // Loaded now, so the form has its choices the moment it opens.

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [role, setRole] = React.useState("");
  const [areFiltersOpen, setAreFiltersOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<User | null>(null);
  const [deleting, setDeleting] = React.useState<User | null>(null);

  const shown = filterUsers(users ?? [], search, status, role);
  const pendingCount = users?.filter((user) => user.status === "pending").length ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#790D16]/20 rounded-sm">
          <UserGroup className="text-branding size-5" />
        </div>
        <div>
          <p className="text-branding text-xl font-medium">Users</p>
          <p className="text-sm text-neutral-700">
            {pendingCount > 0
              ? `${pendingCount} ${pendingCount === 1 ? "account is" : "accounts are"} waiting for activation.`
              : "Everyone's accounts, roles and grade levels."}
          </p>
        </div>
      </div>

      <details className="rounded-md border bg-background">
        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm font-medium">
          How this works
        </summary>
        <ol className="list-decimal space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
          {HOW_IT_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </details>

      {/* On phones the filters stay folded until they are needed. */}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full md:hidden"
        aria-expanded={areFiltersOpen}
        onClick={() => setAreFiltersOpen(!areFiltersOpen)}
      >
        <Filter />
        Search and filter
      </Button>
      <div
        className={`flex-col sm:flex-row gap-3 sm:items-end md:flex ${
          areFiltersOpen ? "flex" : "hidden"
        }`}
      >
        <div className="space-y-1 sm:w-72">
          <label htmlFor="user-search" className="text-sm text-neutral-800">
            Search
          </label>
          <InputGroup className="h-11">
            <InputGroupInput
              id="user-search"
              className="h-11"
              placeholder="Name, email or role"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon className="text-muted-foreground" />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <div className="space-y-1 sm:w-48">
          <label htmlFor="status-filter" className="text-sm text-neutral-800">
            Status
          </label>
          <NativeSelect
            id="status-filter"
            className="w-full [&_select]:h-11"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <NativeSelectOption value="">All statuses</NativeSelectOption>
            {(Object.keys(STATUS_LABELS) as User["status"][]).map((item) => (
              <NativeSelectOption key={item} value={item}>
                {STATUS_LABELS[item]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1 sm:w-48">
          <label htmlFor="role-filter" className="text-sm text-neutral-800">
            Role
          </label>
          <NativeSelect
            id="role-filter"
            className="w-full [&_select]:h-11"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <NativeSelectOption value="">All roles</NativeSelectOption>
            {(Object.keys(ROLE_LABELS) as RoleName[]).map((item) => (
              <NativeSelectOption key={item} value={item}>
                {ROLE_LABELS[item]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the accounts.</p>}
      {users && shown.length === 0 && (
        <p className="text-sm text-neutral-700">No account matches your search.</p>
      )}

      {shown.length > 0 && (
        <>
          <div className="hidden md:block">
            <UsersTable users={shown} myId={me?.id} onManage={setSelected} onDelete={setDeleting} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {shown.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isMe={user.id === me?.id}
                onManage={setSelected}
                onDelete={setDeleting}
              />
            ))}
          </div>
        </>
      )}

      {selected && (
        <ActivationSheet
          key={selected.id}
          user={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {deleting && (
        <DeleteUserSheet key={deleting.id} user={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
};

export default UsersIndex;
