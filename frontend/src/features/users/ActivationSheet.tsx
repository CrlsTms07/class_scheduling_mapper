import React from "react";
import { useAccessOptions, useActivateUser } from "@/api/users";
import { apiErrorMessage } from "@/lib/forms";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ROLE_LABELS } from "@/lib/navigation";
import type { RoleName, User } from "@/types/api";
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

const ActivationSheet = ({ user, onClose }: { user: User; onClose: () => void }) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const { data: options } = useAccessOptions();
  const activate = useActivateUser();

  const [role, setRole] = React.useState<RoleName | "">(user.role ?? "");
  const [gradeIds, setGradeIds] = React.useState<number[]>(
    user.grade_levels.map(({ id }) => id),
  );
  const [teacherId, setTeacherId] = React.useState<number | null>(null);

  const requiredLevel = role ? ROLE_LEVEL[role] : undefined;
  const availableGrades =
    options?.grade_levels.filter(({ level }) => level === requiredLevel) ?? [];

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
          <SheetTitle className="text-branding">
            {user.first_name} {user.last_name}
          </SheetTitle>
          <SheetDescription className="break-all">{user.email}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {activate.isError && <FormAlert>{apiErrorMessage(activate.error)}</FormAlert>}

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
              {options?.teachers.map(({ id, first_name, last_name }) => (
                <NativeSelectOption key={id} value={id}>
                  {last_name}, {first_name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              className="h-11"
              disabled={!role || activate.isPending}
              onClick={handleSubmit}
            >
              {activate.isPending ? "Saving..." : "Save and activate"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ActivationSheet;
