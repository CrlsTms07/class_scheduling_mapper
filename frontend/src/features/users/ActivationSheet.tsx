import React from "react";
import {
  useAccessOptions,
  useActivateUser,
  useChangeUserStatus,
  useDeclineUser,
} from "@/api/users";
import { apiErrorMessage } from "@/lib/forms";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ROLE_LABELS } from "@/lib/navigation";
import { fullName } from "@/lib/users";
import type { RoleName, User } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";
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

const SELECT_CLASS = "w-full [&_select]:h-11";

// Which grade levels each scheduler role may be given.
const ROLE_LEVEL: Partial<Record<RoleName, "JHS" | "SHS">> = {
  glc: "JHS",
  master_teacher: "SHS",
};

/**
 * What the Admin does with one account. A pending account gets a role or is declined,
 * an active one can change access or be deactivated, and a deactivated one can come back.
 */
const ActivationSheet = ({ user, onClose }: { user: User; onClose: () => void }) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const { data: options } = useAccessOptions();
  const activate = useActivateUser();
  const changeStatus = useChangeUserStatus(user.id);
  const decline = useDeclineUser(user.id);

  const [role, setRole] = React.useState<RoleName | "">(user.role ?? "");
  const [gradeIds, setGradeIds] = React.useState<number[]>(
    user.grade_levels.map(({ id }) => id),
  );
  // Starts on the current record, so saving other changes does not unlink it.
  const [teacherId, setTeacherId] = React.useState<number | null>(user.personnel?.id ?? null);

  const requiredLevel = role ? ROLE_LEVEL[role] : undefined;
  const availableGrades =
    options?.grade_levels.filter(({ level }) => level === requiredLevel) ?? [];
  const error = activate.error ?? changeStatus.error ?? decline.error;

  const handleRoleChange = (value: RoleName | "") => {
    setRole(value);
    setGradeIds([]); // Grade levels belong to one department, so they start over.
  };

  const toggleGrade = (id: number) =>
    setGradeIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const handleSubmit = () => {
    if (!role) return;

    activate.mutate(
      {
        userId: user.id,
        role,
        grade_level_ids: requiredLevel ? gradeIds : [],
        teacher_id: teacherId,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">{fullName(user)}</SheetTitle>
          <SheetDescription className="break-all">{user.email}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {error && <FormAlert>{apiErrorMessage(error)}</FormAlert>}

          {user.status === "inactive" ? (
            <>
              <p className="text-sm text-neutral-800">
                This account is deactivated, so it cannot sign in. Reactivating brings it back with
                the same role and grade levels
                {user.role ? ` (${ROLE_LABELS[user.role]})` : ""}.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  className="h-11"
                  disabled={changeStatus.isPending}
                  onClick={() => changeStatus.mutate("active", { onSuccess: onClose })}
                >
                  {changeStatus.isPending ? "Saving..." : "Reactivate this account"}
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={onClose}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label htmlFor="access-role" className="text-sm text-neutral-800">
                  Role
                </label>
                <NativeSelect
                  id="access-role"
                  className={SELECT_CLASS}
                  value={role}
                  onChange={(event) => handleRoleChange(event.target.value as RoleName | "")}
                >
                  <NativeSelectOption value="">Select a role</NativeSelectOption>
                  {(Object.keys(ROLE_LABELS) as RoleName[]).map((name) => (
                    <NativeSelectOption key={name} value={name}>
                      {ROLE_LABELS[name]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              {requiredLevel && (
                <fieldset className="space-y-1">
                  <legend className="text-sm text-neutral-800">Grade levels</legend>
                  <div className="flex flex-wrap gap-2">
                    {availableGrades.map(({ id, grade }) => {
                      const isOn = gradeIds.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={isOn}
                          onClick={() => toggleGrade(id)}
                          className={`min-h-11 min-w-20 rounded-md border px-2 text-xs font-medium ${
                            isOn
                              ? "bg-[#790D16] text-white border-[#790D16]"
                              : "bg-background text-neutral-700"
                          }`}
                        >
                          Grade {grade}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div className="space-y-1">
                <label htmlFor="access-teacher" className="text-sm text-neutral-800">
                  Personnel record (optional)
                </label>
                <NativeSelect
                  id="access-teacher"
                  className={SELECT_CLASS}
                  value={teacherId ?? ""}
                  onChange={(event) => setTeacherId(Number(event.target.value) || null)}
                >
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {user.personnel && (
                    <NativeSelectOption value={user.personnel.id}>
                      {user.personnel.name} (current)
                    </NativeSelectOption>
                  )}
                  {options?.teachers.map(({ id, first_name, last_name }) => (
                    <NativeSelectOption key={id} value={id}>
                      {last_name}, {first_name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <p className="text-xs text-neutral-700">
                  A teacher needs this to see their own schedule.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="button"
                  className="h-11"
                  disabled={!role || activate.isPending}
                  onClick={handleSubmit}
                >
                  {activate.isPending
                    ? "Saving..."
                    : user.status === "pending"
                      ? "Save and activate"
                      : "Save changes"}
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={onClose}>
                  Close
                </Button>
              </div>

              {user.status === "pending" ? (
                <ConfirmDelete
                  label="Decline this sign-up"
                  warning="This removes the sign-up. The person can sign up again. Are you sure?"
                  confirmLabel="Yes, decline"
                  isPending={decline.isPending}
                  onConfirm={() => decline.mutate(undefined, { onSuccess: onClose })}
                />
              ) : (
                <ConfirmDelete
                  label="Deactivate this account"
                  warning="They will be signed out and cannot sign in until you reactivate them. Their schedules stay as they are."
                  confirmLabel="Yes, deactivate"
                  isPending={changeStatus.isPending}
                  onConfirm={() => changeStatus.mutate("inactive", { onSuccess: onClose })}
                />
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ActivationSheet;
