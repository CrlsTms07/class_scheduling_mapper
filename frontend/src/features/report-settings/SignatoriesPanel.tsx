import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, CopyCheck, Pencil, Plus } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  useAddSignatory,
  useCopySignatories,
  useDeleteSignatory,
  useMoveSignatory,
  useSignatories,
  useUpdateSignatory,
} from "@/api/reportSettings";
import { useSelectedTerm } from "@/context/selectedTerm";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import {
  AUTO_SOURCE_FOR,
  REPORT_TYPE_LABELS,
  signatoriesOf,
  SignatorySchema,
  toSignatoryInput,
  type SignatoryValues,
} from "@/lib/reportSettings";
import type { ReportType, SchoolLevel, Signatory } from "@/types/api";
import ConfirmDelete from "@/components/global-component/ConfirmDelete";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type SignatorySheetProp = {
  termId: number;
  reportType: ReportType | null;
  level: SchoolLevel | null;
  formName: string;
  /** The signatory to edit, or null to add a new one. */
  signatory: Signatory | null;
  onClose: () => void;
};

const SignatorySheet = ({
  termId,
  reportType,
  level,
  formName,
  signatory,
  onClose,
}: SignatorySheetProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const add = useAddSignatory(termId);
  const update = useUpdateSignatory(signatory?.id ?? 0);
  const remove = useDeleteSignatory(signatory?.id ?? 0);
  const save = signatory ? update : add;
  const automatic = reportType ? AUTO_SOURCE_FOR[reportType] : undefined;

  const form = useForm<SignatoryValues>({
    resolver: zodResolver(SignatorySchema),
    defaultValues: {
      label: signatory?.label ?? "",
      useAutomaticName: !!signatory?.auto_source,
      name: signatory?.name ?? "",
      position: signatory?.position ?? "",
    },
  });
  const useAutomaticName = useWatch({ control: form.control, name: "useAutomaticName" });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-branding">
            {signatory ? `Edit ${signatory.label}` : "Add signatory"}
          </SheetTitle>
          <SheetDescription>{formName}</SheetDescription>
        </SheetHeader>

        <form
          noValidate
          className="space-y-4 px-4 pb-4"
          onSubmit={form.handleSubmit((values) =>
            save.mutate(toSignatoryInput(values, reportType, level), { onSuccess: onClose }),
          )}
        >
          {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
          {remove.isError && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}

          <FormTextField
            control={form.control}
            name="label"
            label="Signs as"
            placeholder="Prepared by"
          />

          {automatic && (
            <Controller
              name="useAutomaticName"
              control={form.control}
              render={({ field }) => (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                  <span>
                    <span className="block text-sm font-medium text-neutral-900">
                      Fill the name automatically
                    </span>
                    <span className="block text-xs text-neutral-700">{automatic.label}</span>
                  </span>
                </label>
              )}
            />
          )}

          {!useAutomaticName && (
            <FormTextField control={form.control} name="name" label="Name to print" />
          )}

          <FormTextField
            control={form.control}
            name="position"
            label="Position (optional)"
            placeholder="Head Teacher III"
          />

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="h-11" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Close
            </Button>
          </div>

          {signatory && (
            <ConfirmDelete
              label="Remove this signatory"
              warning="This removes them from this form in this term. Are you sure?"
              confirmLabel="Yes, remove"
              isPending={remove.isPending}
              onConfirm={() => remove.mutate(undefined, { onSuccess: onClose })}
            />
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};

const SignatoriesPanel = () => {
  const { term } = useSelectedTerm();
  const { data: signatories, isPending, isError } = useSignatories(term?.id);
  const move = useMoveSignatory();
  const copy = useCopySignatories(term?.id ?? 0);

  const [reportType, setReportType] = React.useState<ReportType | null>("class_program");
  const [level, setLevel] = React.useState<SchoolLevel | null>("JHS");
  // undefined = closed, null = adding a new signatory
  const [editing, setEditing] = React.useState<Signatory | null | undefined>(undefined);

  if (!term) {
    return (
      <p className="text-sm text-neutral-700">
        Start a school year first, on the School Years page.
      </p>
    );
  }

  const shown = signatoriesOf(signatories ?? [], reportType, level);
  const documentName = reportType ? REPORT_TYPE_LABELS[reportType] : "All documents";
  const levelName = level ?? "JHS and SHS";
  const formName = `${documentName}, ${levelName}, ${term.name}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-700">
        Showing <span className="font-medium">{term.name}, SY {term.school_year.name}</span>. Change
        the term in the selector at the top. On the printed form they sign two per row, in this
        order.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-lg">
        <div className="space-y-1">
          <label htmlFor="signatory-document" className="text-sm text-neutral-800">
            Document
          </label>
          <NativeSelect
            id="signatory-document"
            className="w-full [&_select]:h-11"
            value={reportType ?? ""}
            onChange={(event) => setReportType((event.target.value || null) as ReportType | null)}
          >
            {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((type) => (
              <NativeSelectOption key={type} value={type}>
                {REPORT_TYPE_LABELS[type]}
              </NativeSelectOption>
            ))}
            <NativeSelectOption value="">All documents</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor="signatory-level" className="text-sm text-neutral-800">
            Department
          </label>
          <NativeSelect
            id="signatory-level"
            className="w-full [&_select]:h-11"
            value={level ?? ""}
            onChange={(event) => setLevel((event.target.value || null) as SchoolLevel | null)}
          >
            <NativeSelectOption value="JHS">JHS</NativeSelectOption>
            <NativeSelectOption value="SHS">SHS</NativeSelectOption>
            <NativeSelectOption value="">JHS and SHS</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the signatories.</p>}
      {move.isError && <FormAlert>{apiErrorMessage(move.error)}</FormAlert>}

      {signatories && shown.length === 0 && (
        <p className="text-sm text-neutral-700">There are no signatories on this form yet.</p>
      )}

      <ol className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {shown.map((signatory, index) => (
          <li key={signatory.id}>
            <Card className="shadow shadow-[#790D16]/40">
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-40 flex-1">
                  <p className="text-xs text-neutral-600">{signatory.label}</p>
                  <p className="text-sm font-medium text-neutral-900">
                    {signatory.auto_source
                      ? reportType && AUTO_SOURCE_FOR[reportType]?.label
                      : signatory.name}
                  </p>
                  <p className="text-xs text-neutral-700">{signatory.position}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label={`Move ${signatory.label} up`}
                    disabled={index === 0 || move.isPending}
                    onClick={() => move.mutate({ id: signatory.id, direction: "up" })}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label={`Move ${signatory.label} down`}
                    disabled={index === shown.length - 1 || move.isPending}
                    onClick={() => move.mutate({ id: signatory.id, direction: "down" })}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11"
                    aria-label={`Edit ${signatory.label}`}
                    onClick={() => setEditing(signatory)}
                  >
                    <Pencil />
                  </Button>
                </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3 sm:max-w-lg">
        <Button type="button" className="h-11" onClick={() => setEditing(null)}>
          <Plus />
          Add signatory
        </Button>

        {term.school_year.term_count > 1 && (
          <>
            {copy.isError && <FormAlert>{apiErrorMessage(copy.error)}</FormAlert>}
            {copy.isSuccess && (
              <FormAlert variant="success">
                The other {copy.data.data.terms === 1 ? "term" : `${copy.data.data.terms} terms`} of
                this school year now use these signatories.
              </FormAlert>
            )}
            <ConfirmDelete
              label={`Use ${term.name}'s signatories in all terms`}
              warning={`The other terms of SY ${term.school_year.name} will have the same signatories as ${term.name}, for all documents. What they have now will be replaced.`}
              confirmLabel="Yes, use in all"
              icon={CopyCheck}
              isPending={copy.isPending}
              onConfirm={() => copy.mutate(undefined)}
            />
          </>
        )}
      </div>

      {editing !== undefined && (
        <SignatorySheet
          key={editing?.id ?? "new"}
          termId={term.id}
          reportType={reportType}
          level={level}
          formName={formName}
          signatory={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
};

export default SignatoriesPanel;
