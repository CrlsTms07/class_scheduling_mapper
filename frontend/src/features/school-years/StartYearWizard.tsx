import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router";
import { useStartSchoolYear } from "@/api/calendar";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiErrorMessage } from "@/lib/forms";
import {
  buildTerms,
  CUSTOM_PRESET,
  formatDate,
  SchoolYearSchema,
  suggestNextYear,
  TERM_PRESETS,
} from "@/lib/schoolYear";
import type { CopyOption, CopyResult, SchoolYear, SchoolYearInput } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { TermFields, YearFields } from "./CalendarFields";

const STEPS = ["School year", "Term structure", "Copy from last year", "Review"];
const DEFAULT_PRESET = TERM_PRESETS[0];

const countOf = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** The choices on the copy step, with how much the source year has of each. */
function copyChoices(source: SchoolYear): { key: CopyOption; title: string; hint: string }[] {
  const { subjects, day_patterns: patterns, signatories, sections } = source.counts;

  return [
    {
      key: "subjects",
      title: "Subjects",
      hint: `${countOf(subjects, "subject", "subjects")}. The old year keeps its own copy.`,
    },
    {
      key: "time_slots",
      title: "Time slots and breaks",
      hint: `${countOf(patterns, "bell schedule", "bell schedules")}.`,
    },
    {
      key: "signatories",
      title: "Report signatories",
      hint:
        signatories > 0
          ? "The names and positions on printed forms."
          : "None have been set in this year yet.",
    },
    {
      key: "section_names",
      title: "Section names, one grade up",
      hint: `${countOf(sections, "section", "sections")}. Grade 7 Honesty becomes Grade 8 Honesty. Grade 12 is left out. You set advisers and rooms again.`,
    },
  ];
}

/** Plain-words lines of what was copied. */
function copiedLines(copied: CopyResult): string[] {
  const lines: [number | undefined, string, string][] = [
    [copied.subjects, "subject", "subjects"],
    [copied.day_patterns, "bell schedule", "bell schedules"],
    [copied.sections, "section name", "section names"],
  ];

  return [
    ...lines.flatMap(([count, one, many]) =>
      count === undefined ? [] : [countOf(count, one, many)],
    ),
    // Each term has its own copy of the same people, so a count would mislead.
    ...(copied.signatories ? ["the report signatories"] : []),
  ];
}

type StartYearWizardProp = {
  years: SchoolYear[];
  activeTermName?: string;
  onClose: () => void;
};

const StartYearWizard = ({ years, activeTermName, onClose }: StartYearWizardProp) => {
  const isPhonePortrait = useMediaQuery("(orientation: portrait) and (max-width: 767px)");
  const start = useStartSchoolYear();

  const latest = years[0];
  const suggested = suggestNextYear(latest);

  const [step, setStep] = React.useState(0);
  const [presetKey, setPresetKey] = React.useState(DEFAULT_PRESET.key);
  const [sourceId, setSourceId] = React.useState<number | null>(latest?.id ?? null);
  const [copy, setCopy] = React.useState<Record<CopyOption, boolean>>({
    subjects: true,
    time_slots: true,
    signatories: true,
    section_names: false,
  });
  // The year dates the terms were last generated from.
  const [generatedFrom, setGeneratedFrom] = React.useState(
    `${suggested.start_date}|${suggested.end_date}`,
  );

  const form = useForm<SchoolYearInput>({
    resolver: zodResolver(SchoolYearSchema),
    defaultValues: {
      ...suggested,
      term_label: DEFAULT_PRESET.label,
      terms: buildTerms(
        DEFAULT_PRESET.count,
        DEFAULT_PRESET.label,
        suggested.start_date,
        suggested.end_date,
      ),
    },
  });

  // Always the latest answers, for the Review step.
  const values = useWatch({ control: form.control }) as SchoolYearInput;
  const source = years.find(({ id }) => id === sourceId);

  const applyPreset = (key: string) => {
    setPresetKey(key);
    const preset = TERM_PRESETS.find((item) => item.key === key);
    if (!preset) return; // Custom keeps the current terms, ready to edit.

    const { start_date, end_date } = form.getValues();
    form.setValue("term_label", preset.label);
    form.setValue("terms", buildTerms(preset.count, preset.label, start_date, end_date));
    form.clearErrors("terms");
  };

  const goNext = async () => {
    if (step === 0) {
      if (!(await form.trigger(["name", "start_date", "end_date"]))) return;

      // New year dates mean new term dates, unless the Admin is building their own.
      const { start_date, end_date } = form.getValues();
      const dates = `${start_date}|${end_date}`;
      if (dates !== generatedFrom && presetKey !== CUSTOM_PRESET) {
        applyPreset(presetKey);
      }
      setGeneratedFrom(dates);
    }

    if (step === 1 && !(await form.trigger(["term_label", "terms"]))) return;

    setStep(step + 1);
  };

  const handleConfirm = form.handleSubmit((values) =>
    start.mutate({
      ...values,
      copy_from_id: source?.id ?? null,
      copy,
    }),
  );

  const chosenCopies = source ? copyChoices(source).filter(({ key }) => copy[key]) : [];

  const renderStep = () => {
    if (step === 0) {
      return (
        <>
          <p className="text-xs text-neutral-700">
            Enter the first and last day of classes for the whole school year.
          </p>
          <YearFields form={form} />
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <p className="text-xs text-neutral-700">
            Pick how the year is divided. The dates below are an even split, so adjust them to the
            official calendar.
          </p>
          <div role="group" aria-label="Term structure" className="grid grid-cols-2 gap-2">
            {[
              ...TERM_PRESETS,
              { key: CUSTOM_PRESET, title: "Custom", hint: "Set your own" },
            ].map(({ key, title, hint }) => {
              const isOn = key === presetKey;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => applyPreset(key)}
                  className={`min-h-11 rounded-md border p-2 text-left text-sm ${
                    isOn
                      ? "bg-[#790D16] text-white border-[#790D16]"
                      : "bg-background text-neutral-800"
                  }`}
                >
                  <span className="block font-medium">{title}</span>
                  <span className="block text-xs opacity-80">{hint}</span>
                </button>
              );
            })}
          </div>
          <TermFields form={form} canChangeStructure={presetKey === CUSTOM_PRESET} />
        </>
      );
    }

    if (step === 2) {
      if (years.length === 0) {
        return (
          <p className="text-sm text-neutral-700">
            This is the first school year, so there is nothing to copy yet.
          </p>
        );
      }

      return (
        <>
          <p className="text-xs text-neutral-700">
            Copying saves encoding. You can still edit everything afterwards. Schedules are never
            copied here.
          </p>
          <div className="space-y-1">
            <label htmlFor="copy-source" className="text-sm text-neutral-800">
              Copy from
            </label>
            <NativeSelect
              id="copy-source"
              className="w-full [&_select]:h-11"
              value={sourceId ?? ""}
              onChange={(event) => setSourceId(Number(event.target.value) || null)}
            >
              <NativeSelectOption value="">Do not copy anything</NativeSelectOption>
              {years.map(({ id, name }) => (
                <NativeSelectOption key={id} value={id}>
                  School year {name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          {source && (
            <div className="space-y-2">
              {copyChoices(source).map(({ key, title, hint }) => (
                <label
                  key={key}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={copy[key]}
                    onCheckedChange={(checked) =>
                      setCopy((current) => ({ ...current, [key]: checked }))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-neutral-900">{title}</span>
                    <span className="block text-xs text-neutral-700">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </>
      );
    }

    return (
      <>
        {start.isError && <FormAlert>{apiErrorMessage(start.error)}</FormAlert>}
        <dl className="space-y-3 rounded-md border p-3 text-sm">
          <div>
            <dt className="text-xs text-neutral-600">School year</dt>
            <dd className="font-medium">
              {values.name} ({formatDate(values.start_date)} to {formatDate(values.end_date)})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-600">
              {countOf(values.terms.length, "part", "parts")}
            </dt>
            {values.terms.map(({ name, start_date, end_date }) => (
              <dd key={name}>
                <span className="font-medium">{name}:</span> {formatDate(start_date)} to{" "}
                {formatDate(end_date)}
              </dd>
            ))}
          </div>
          <div>
            <dt className="text-xs text-neutral-600">
              {source ? `Copy from ${source.name}` : "Copy"}
            </dt>
            <dd>
              {chosenCopies.length > 0
                ? chosenCopies.map(({ title }) => title).join(", ")
                : "Nothing"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-neutral-700">
          {activeTermName
            ? `${activeTermName} stays the active term. Switch it on this page when the new year begins.`
            : "No term is active yet. Set one as active on this page when classes begin."}
        </p>
      </>
    );
  };

  const copied = start.data?.copied;
  const lines = copied ? copiedLines(copied) : [];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isPhonePortrait ? "bottom" : "right"}
        className="max-h-[90dvh] overflow-y-auto data-[side=right]:sm:max-w-lg"
      >
        {start.isSuccess ? (
          <>
            <SheetHeader>
              <SheetTitle className="text-branding">
                School year {start.data.data.name} is ready
              </SheetTitle>
              <SheetDescription>Here is what happened and what to do next.</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4 text-sm">
              <FormAlert variant="success">
                {lines.length > 0 ? `Copied ${lines.join(", ")}.` : "Nothing was copied."}
              </FormAlert>
              {!!copied?.subjects_skipped && (
                <FormAlert>
                  {countOf(copied.subjects_skipped, "subject was", "subjects were")} not copied
                  because they belong to a term this year does not have. Encode them again if they
                  are still needed.
                </FormAlert>
              )}
              <div className="space-y-2">
                <p className="font-medium text-neutral-900">Next steps</p>
                <Link to="/time-slots" className={buttonVariants({ variant: "outline", className: "h-11 w-full" })}>
                  Check Time Slots
                </Link>
                <Link to="/sections" className={buttonVariants({ variant: "outline", className: "h-11 w-full" })}>
                  Encode Sections
                </Link>
              </div>
              <Button type="button" className="h-11 w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-branding">Start New School Year</SheetTitle>
              <SheetDescription>
                Step {step + 1} of {STEPS.length}: {STEPS[step]}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-4">
              <div
                role="progressbar"
                aria-label="Wizard progress"
                aria-valuemin={1}
                aria-valuemax={STEPS.length}
                aria-valuenow={step + 1}
                className="flex gap-1"
              >
                {STEPS.map((name, index) => (
                  <span
                    key={name}
                    className={`h-1.5 flex-1 rounded-full ${
                      index <= step ? "bg-[#790D16]" : "bg-neutral-200"
                    }`}
                  />
                ))}
              </div>

              {renderStep()}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
                >
                  {step === 0 ? "Cancel" : "Back"}
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button type="button" className="h-11" onClick={goNext}>
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="h-11"
                    disabled={start.isPending}
                    onClick={handleConfirm}
                  >
                    {start.isPending ? "Creating..." : "Create school year"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default StartYearWizard;
