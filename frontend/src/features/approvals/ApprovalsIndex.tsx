import React from "react";
import { Link } from "react-router";
import { TriangleAlert } from "lucide-react";
import { useApprovals, useReviewSchedules } from "@/api/approvals";
import { useSelectedTerm } from "@/context/selectedTerm";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/schedule";
import { apiErrorMessage } from "@/lib/forms";
import type { ApprovalSection, ReviewAction, ReviewInput } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import ReviewSheet from "./ReviewSheet";

type Scope = { value: string; label: string; input: Omit<ReviewInput, "action" | "remarks">; includes: (section: ApprovalSection) => boolean };

/** The scopes the Admin can act on: everything, a department, a grade level or one section. */
function scopesFor(sections: ApprovalSection[]): Scope[] {
  const levels = [...new Set(sections.map(({ level }) => level))];
  const grades = [...new Map(sections.map((section) => [section.grade, section])).values()];

  return [
    { value: "all", label: "All sections", input: { scope: "all" }, includes: () => true },
    ...levels.map((level) => ({
      value: level,
      label: `All ${level}`,
      input: { scope: level },
      includes: (section: ApprovalSection) => section.level === level,
    })),
    ...grades.map(({ grade, grade_level_id }) => ({
      value: `grade-${grade_level_id}`,
      label: `Grade ${grade}`,
      input: { scope: "grade_level" as const, scope_ref_id: grade_level_id },
      includes: (section: ApprovalSection) => section.grade_level_id === grade_level_id,
    })),
    ...sections.map((section) => ({
      value: `section-${section.id}`,
      label: section.label,
      input: { scope: "section" as const, scope_ref_id: section.id },
      includes: (other: ApprovalSection) => other.id === section.id,
    })),
  ];
}

const ApprovalsIndex = () => {
  const { term } = useSelectedTerm();
  const { data: sections, isPending, isError } = useApprovals(term?.id);
  const review = useReviewSchedules(term?.id);
  const [scopeValue, setScopeValue] = React.useState("all");
  const [action, setAction] = React.useState<ReviewAction | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  if (isError) {
    return <p className="p-6 text-sm text-destructive">Could not load the schedules.</p>;
  }

  if (isPending || !sections) {
    return <p className="p-6 text-sm text-neutral-600">Loading...</p>;
  }

  const scopes = scopesFor(sections);
  const scope = scopes.find(({ value }) => value === scopeValue) ?? scopes[0];
  const inScope = sections.filter(scope.includes);

  const pending = inScope.filter(({ pending_count }) => pending_count > 0);
  const approved = inScope.filter(({ approved_count }) => approved_count > 0);
  const notReady = inScope.filter(({ status }) => status === "not_started" || status === "draft");
  const flagged = pending.filter(({ flags }) => flags.length > 0);
  const pendingEntries = pending.reduce((sum, { pending_count }) => sum + pending_count, 0);
  const approvedEntries = approved.reduce((sum, { approved_count }) => sum + approved_count, 0);

  const handleConfirm = (remarks: string) => {
    if (!action) return;

    review.mutate(
      { ...scope.input, action, remarks: remarks || undefined },
      {
        onSuccess: ({ data }) => {
          const verb = { approve: "Approved", reject: "Rejected", reopen: "Reopened" }[action];
          setDone(`${verb} ${data.entries} entries in ${data.sections} ${data.sections === 1 ? "section" : "sections"}.`);
          setAction(null);
        },
      },
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div>
        <p className="text-branding text-xl font-medium">Approvals</p>
        <p className="text-sm text-neutral-700">
          {term ? `${term.name}, SY ${term.school_year.name}` : ""}
        </p>
      </div>

      {done && <FormAlert variant="success">{done}</FormAlert>}

      <Card className="shadow shadow-[#790D16]/40">
        <CardContent className="space-y-4">
          <div className="space-y-1 max-w-sm">
            <label htmlFor="approval-scope" className="text-sm text-neutral-800">
              Review
            </label>
            <NativeSelect
              id="approval-scope"
              className="w-full [&_select]:h-11"
              value={scope.value}
              onChange={(event) => {
                setScopeValue(event.target.value);
                setDone(null);
              }}
            >
              {scopes.map(({ value, label }) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            {[
              ["Pending sections", pending.length],
              ["Pending entries", pendingEntries],
              ["With flags", flagged.length],
              ["Not yet submitted", notReady.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-neutral-100 p-2">
                <dt className="text-xs text-neutral-600">{label}</dt>
                <dd className="text-lg font-bold text-teal-700">{value}</dd>
              </div>
            ))}
          </dl>

          {notReady.length > 0 && pending.length > 0 && (
            <p className="flex gap-2 text-xs text-amber-900">
              <TriangleAlert className="size-4 shrink-0" />
              Not included because they are not yet submitted:{" "}
              {notReady.map(({ label }) => label).join(", ")}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              className="h-11"
              disabled={pending.length === 0}
              onClick={() => setAction("approve")}
            >
              Approve {pending.length > 0 ? `${pending.length} pending` : ""}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              disabled={pending.length === 0}
              onClick={() => setAction("reject")}
            >
              Reject
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={approved.length === 0}
              onClick={() => setAction("reopen")}
            >
              Reopen {approved.length > 0 ? `${approved.length} approved` : ""}
            </Button>
          </div>
        </CardContent>
      </Card>

      {sections.length === 0 && (
        <p className="text-sm text-neutral-700">
          There are no sections in this school year yet.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {inScope.map((section) => {
          const open = section.flags.filter(({ acknowledged }) => !acknowledged);
          const acknowledged = section.flags.length - open.length;

          return (
            <Card key={section.id}>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-bold text-sm text-teal-700">{section.label}</p>
                  <Badge className={STATUS_COLORS[section.status]}>
                    {STATUS_LABELS[section.status]}
                  </Badge>
                </div>
                <p className="text-xs text-neutral-700">
                  Adviser: {section.adviser ?? "None yet"}
                </p>
                {section.flags.length > 0 && (
                  <details className="text-xs">
                    <summary className="flex min-h-11 cursor-pointer items-center text-amber-900">
                      {section.flags.length} {section.flags.length === 1 ? "flag" : "flags"}
                      {acknowledged > 0 && ` (${acknowledged} acknowledged)`}
                    </summary>
                    <ul className="list-disc pl-4 space-y-1">
                      {section.flags.map((flag) => (
                        <li key={flag.key}>
                          {flag.message}
                          {flag.acknowledged && " (acknowledged)"}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <Link
                  to={`/schedule/sections/${section.id}`}
                  className={buttonVariants({ variant: "outline", className: "h-11 w-full" })}
                >
                  View schedule
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {action && (
        <ReviewSheet
          action={action}
          scopeLabel={scope.label}
          sectionCount={action === "reopen" ? approved.length : pending.length}
          entryCount={action === "reopen" ? approvedEntries : pendingEntries}
          flaggedLabels={action === "reopen" ? [] : flagged.map(({ label }) => label)}
          isSaving={review.isPending}
          error={review.isError ? apiErrorMessage(review.error) : null}
          onConfirm={handleConfirm}
          onClose={() => {
            setAction(null);
            review.reset();
          }}
        />
      )}
    </div>
  );
};

export default ApprovalsIndex;
