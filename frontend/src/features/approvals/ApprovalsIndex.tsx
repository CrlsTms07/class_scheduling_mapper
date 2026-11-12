import React from "react";
import { Link } from "react-router";
import { CircleCheck, Clock3, FileWarning, Hourglass, Search, TriangleAlert } from "lucide-react";
import { useApprovals, useReviewSchedules } from "@/api/approvals";
import { useSelectedTerm } from "@/context/selectedTerm";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/schedule";
import { apiErrorMessage } from "@/lib/forms";
import type { ApprovalSection, ReviewAction, ReviewInput } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import ReviewSheet from "./ReviewSheet";

type Tab = "pending" | "approved" | "not_submitted" | "all";

const TABS: { key: Tab; label: string; includes: (section: ApprovalSection) => boolean }[] = [
  { key: "pending", label: "Pending", includes: ({ pending_count }) => pending_count > 0 },
  { key: "approved", label: "Approved", includes: ({ approved_count }) => approved_count > 0 },
  { key: "not_submitted", label: "Not submitted", includes: ({ status }) => ["not_started", "draft", "rejected"].includes(status) },
  { key: "all", label: "All", includes: () => true },
];

/** What the Admin is about to act on: the filtered sections, or one section from its row. */
type Target = {
  action: ReviewAction;
  label: string;
  input: Omit<ReviewInput, "action" | "remarks">;
  sections: ApprovalSection[];
};

const Kpi = ({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: number; note: string; tone: string }) => (
  <Card className="shadow shadow-[#790D16]/20">
    <CardContent className="flex items-start gap-3">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-neutral-600">{label}</p>
        <p className="text-2xl font-bold text-neutral-900">{value}</p>
        <p className="truncate text-xs text-neutral-600">{note}</p>
      </div>
    </CardContent>
  </Card>
);

const FlagSummary = ({ section }: { section: ApprovalSection }) => {
  if (section.flags.length === 0) return <span className="text-xs text-neutral-500">None</span>;

  const open = section.flags.filter(({ acknowledged }) => !acknowledged).length;

  return (
    <details className="text-xs">
      <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-amber-900">
        <TriangleAlert className="size-3.5" />
        {section.flags.length} {section.flags.length === 1 ? "flag" : "flags"}
        {open < section.flags.length && ` (${section.flags.length - open} acknowledged)`}
      </summary>
      <ul className="list-disc space-y-1 pl-4 text-neutral-800">
        {section.flags.map((flag) => (
          <li key={flag.key}>
            {flag.message}
            {flag.acknowledged && " (acknowledged)"}
          </li>
        ))}
      </ul>
    </details>
  );
};

type RowActionsProp = { section: ApprovalSection; onAct: (target: Target) => void };

/** The actions that fit this section now: approve or reject what is pending, reopen what is approved. */
const RowActions = ({ section, onAct }: RowActionsProp) => {
  const act = (action: ReviewAction) =>
    onAct({ action, label: section.label, input: { scope: "section", scope_ref_id: section.id }, sections: [section] });

  return (
    <div className="flex flex-wrap gap-2">
      <Link to={`/schedule/sections/${section.id}`} className={buttonVariants({ variant: "outline", className: "h-11" })}>
        View
      </Link>
      {section.pending_count > 0 && (
        <>
          <Button type="button" className="h-11" aria-label={`Approve ${section.label}`} onClick={() => act("approve")}>
            Approve
          </Button>
          <Button type="button" variant="outline" className="h-11 text-destructive" aria-label={`Reject ${section.label}`} onClick={() => act("reject")}>
            Reject
          </Button>
        </>
      )}
      {section.approved_count > 0 && section.pending_count === 0 && (
        <Button type="button" variant="outline" className="h-11" aria-label={`Reopen ${section.label}`} onClick={() => act("reopen")}>
          Reopen
        </Button>
      )}
    </div>
  );
};

/**
 * Approvals: the Admin reviews what the Chairpersons and Master Teacher submitted, for one
 * section from its row, or for everything the filters show at once.
 */
const ApprovalsIndex = () => {
  const { term } = useSelectedTerm();
  const { data: sections, isPending, isError } = useApprovals(term?.id);
  const review = useReviewSchedules(term?.id);
  const [tab, setTab] = React.useState<Tab>("pending");
  const [level, setLevel] = React.useState<"" | "JHS" | "SHS">("");
  const [gradeLevelId, setGradeLevelId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [target, setTarget] = React.useState<Target | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  if (isError) return <p className="p-6 text-sm text-destructive">Could not load the schedules.</p>;
  if (isPending || !sections) return <p className="p-6 text-sm text-neutral-600">Loading...</p>;

  const grades = [...new Map(sections.filter((s) => !level || s.level === level).map((s) => [s.grade_level_id, s.grade])).entries()].sort(
    (a, b) => a[1] - b[1],
  );
  const query = search.trim().toLowerCase();

  // The department and grade filters are also the scope of the actions at the top.
  const inScope = sections.filter(
    (section) => (!level || section.level === level) && (!gradeLevelId || section.grade_level_id === Number(gradeLevelId)),
  );
  const shown = inScope.filter(
    (section) =>
      TABS.find(({ key }) => key === tab)!.includes(section) &&
      (query === "" || section.label.toLowerCase().includes(query) || (section.adviser ?? "").toLowerCase().includes(query)),
  );

  const pending = inScope.filter(({ pending_count }) => pending_count > 0);
  const approved = inScope.filter(({ approved_count }) => approved_count > 0);
  const notSubmitted = inScope.filter(TABS[2].includes);
  const flagged = pending.filter(({ flags }) => flags.length > 0);

  const scopeLabel = gradeLevelId
    ? `Grade ${grades.find(([id]) => id === Number(gradeLevelId))?.[1]}`
    : level
      ? `All ${level}`
      : "All sections";
  const scopeInput: Target["input"] = gradeLevelId
    ? { scope: "grade_level", scope_ref_id: Number(gradeLevelId) }
    : level
      ? { scope: level }
      : { scope: "all" };

  const sum = (list: ApprovalSection[], key: "pending_count" | "approved_count") => list.reduce((total, section) => total + section[key], 0);

  const handleConfirm = (remarks: string) => {
    if (!target) return;

    review.mutate(
      { ...target.input, action: target.action, remarks: remarks || undefined },
      {
        onSuccess: ({ data }) => {
          const verb = { approve: "Approved", reject: "Rejected", reopen: "Reopened" }[target.action];
          setDone(`${verb} ${data.entries} entries in ${data.sections} ${data.sections === 1 ? "section" : "sections"}.`);
          setTarget(null);
        },
      },
    );
  };

  const targetSections = target ? (target.action === "reopen" ? target.sections.filter((s) => s.approved_count > 0) : target.sections.filter((s) => s.pending_count > 0)) : [];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-branding text-xl font-medium">Approvals</p>
          <p className="text-sm text-neutral-700">
            Review the schedules submitted by the Chairpersons and the Master Teacher
            {term ? ` for ${term.name}, SY ${term.school_year.name}` : ""}.
          </p>
        </div>
      </div>

      {done && <FormAlert variant="success">{done}</FormAlert>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={<Hourglass className="size-5" />} tone="bg-amber-100 text-amber-800" label="Waiting for review" value={pending.length} note={`${sum(pending, "pending_count")} entries`} />
        <Kpi icon={<CircleCheck className="size-5" />} tone="bg-emerald-100 text-emerald-800" label="Approved" value={approved.length} note={`${sum(approved, "approved_count")} entries`} />
        <Kpi icon={<FileWarning className="size-5" />} tone="bg-red-100 text-red-800" label="Pending with flags" value={flagged.length} note={flagged.length ? "Check before approving" : "Nothing to check"} />
        <Kpi icon={<Clock3 className="size-5" />} tone="bg-neutral-200 text-neutral-800" label="Not submitted" value={notSubmitted.length} note="Still being prepared" />
      </div>

      <Card className="shadow shadow-[#790D16]/20">
        <CardContent className="space-y-4">
          <div role="tablist" aria-label="Show" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-2xl">
            {TABS.map(({ key, label, includes }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`min-h-11 rounded-md border px-2 text-sm font-medium ${
                  tab === key ? "bg-[#790D16] text-white border-[#790D16]" : "bg-background text-neutral-700"
                }`}
              >
                {label} ({inScope.filter(includes).length})
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="approval-level" className="text-sm text-neutral-800">
                Department
              </label>
              <NativeSelect
                id="approval-level"
                className="w-full [&_select]:h-11"
                value={level}
                onChange={(event) => {
                  setLevel(event.target.value as "" | "JHS" | "SHS");
                  setGradeLevelId("");
                  setDone(null);
                }}
              >
                <NativeSelectOption value="">All departments</NativeSelectOption>
                <NativeSelectOption value="JHS">Junior High School</NativeSelectOption>
                <NativeSelectOption value="SHS">Senior High School</NativeSelectOption>
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <label htmlFor="approval-grade" className="text-sm text-neutral-800">
                Grade level
              </label>
              <NativeSelect
                id="approval-grade"
                className="w-full [&_select]:h-11"
                value={gradeLevelId}
                onChange={(event) => {
                  setGradeLevelId(event.target.value);
                  setDone(null);
                }}
              >
                <NativeSelectOption value="">All grades</NativeSelectOption>
                {grades.map(([id, grade]) => (
                  <NativeSelectOption key={id} value={id}>
                    Grade {grade}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <label htmlFor="approval-search" className="text-sm text-neutral-800">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 size-4 text-neutral-500" />
                <Input
                  id="approval-search"
                  type="search"
                  className="h-11 pl-9"
                  placeholder="Section or adviser"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-md border bg-neutral-50 p-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-neutral-800">
              <span className="font-medium">{scopeLabel}:</span> {pending.length} waiting for review
              {flagged.length > 0 && `, ${flagged.length} with flags`}.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="h-11"
                disabled={pending.length === 0}
                onClick={() => setTarget({ action: "approve", label: scopeLabel, input: scopeInput, sections: inScope })}
              >
                Approve {pending.length > 0 ? `${pending.length} pending` : ""}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-11"
                disabled={pending.length === 0}
                onClick={() => setTarget({ action: "reject", label: scopeLabel, input: scopeInput, sections: inScope })}
              >
                Reject {pending.length > 0 ? `${pending.length} pending` : ""}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={approved.length === 0}
                onClick={() => setTarget({ action: "reopen", label: scopeLabel, input: scopeInput, sections: inScope })}
              >
                Reopen {approved.length > 0 ? `${approved.length} approved` : ""}
              </Button>
            </div>
          </div>
          {notSubmitted.length > 0 && pending.length > 0 && (
            <p className="flex gap-2 text-xs text-amber-900">
              <TriangleAlert className="size-4 shrink-0" />
              Not included because they are not yet submitted: {notSubmitted.map(({ label }) => label).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      {sections.length === 0 && <p className="text-sm text-neutral-700">There are no sections in this school year yet.</p>}
      {sections.length > 0 && shown.length === 0 && (
        <p className="text-sm text-neutral-700">No section matches what is chosen above.</p>
      )}

      {shown.length > 0 && (
        <>
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs text-neutral-700">
                <tr>
                  <th className="p-3 font-medium">Section</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Entries</th>
                  <th className="p-3 font-medium">Flags</th>
                  <th className="p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((section) => (
                  <tr key={section.id} className="border-t align-top">
                    <td className="p-3">
                      <p className="font-medium text-neutral-900">{section.label}</p>
                      <p className="text-xs text-neutral-600">
                        {section.level} · Adviser: {section.adviser ?? "None yet"}
                      </p>
                    </td>
                    <td className="p-3">
                      <Badge className={STATUS_COLORS[section.status]}>{STATUS_LABELS[section.status]}</Badge>
                    </td>
                    <td className="p-3 text-xs text-neutral-700">
                      {section.pending_count > 0 && <p>{section.pending_count} pending</p>}
                      {section.approved_count > 0 && <p>{section.approved_count} approved</p>}
                      {section.pending_count + section.approved_count === 0 && <p>–</p>}
                    </td>
                    <td className="p-3">
                      <FlagSummary section={section} />
                    </td>
                    <td className="p-3">
                      <RowActions section={section} onAct={setTarget} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 md:hidden">
            {shown.map((section) => (
              <Card key={section.id}>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-teal-700">{section.label}</p>
                      <p className="text-xs text-neutral-700">Adviser: {section.adviser ?? "None yet"}</p>
                    </div>
                    <Badge className={STATUS_COLORS[section.status]}>{STATUS_LABELS[section.status]}</Badge>
                  </div>
                  <FlagSummary section={section} />
                  <RowActions section={section} onAct={setTarget} />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {target && (
        <ReviewSheet
          action={target.action}
          scopeLabel={target.label}
          sectionCount={targetSections.length}
          entryCount={sum(targetSections, target.action === "reopen" ? "approved_count" : "pending_count")}
          flaggedLabels={target.action === "reopen" ? [] : targetSections.filter(({ flags }) => flags.length > 0).map(({ label }) => label)}
          isSaving={review.isPending}
          error={review.isError ? apiErrorMessage(review.error) : null}
          onConfirm={handleConfirm}
          onClose={() => {
            setTarget(null);
            review.reset();
          }}
        />
      )}
    </div>
  );
};

export default ApprovalsIndex;
