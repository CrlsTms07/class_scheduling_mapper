import { Link } from "react-router";
import { ArrowRight, BookOpen, Lightbulb, Printer } from "lucide-react";
import { useMe } from "@/api/auth";
import { Crumbs } from "@/components/global-component/ScheduleUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SCHEDULE_GUIDE, type GuideStep } from "./scheduleGuide";

/** Each step's number across all parts (1, 2, 3...), counted once. */
const STEP_NUMBERS = new Map<GuideStep, number>(SCHEDULE_GUIDE.flatMap(({ steps }) => steps).map((step, index) => [step, index + 1]));

/**
 * "How to make a schedule": every step from the start of the school year to the printed forms,
 * with who does it and a link to where it is done. The user's own steps are marked.
 */
const ScheduleGuidePage = () => {
  const { data: user } = useMe();

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <Crumbs items={[{ label: "Home", to: "/dashboard" }, { label: "Schedule", to: "/schedule" }, { label: "How to make a schedule" }]} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#790D16] text-white">
            <BookOpen className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-branding">How to make a schedule</h1>
            <p className="text-sm text-neutral-700">
              From the start of the school year to the printed Class Program, step by step. Steps marked "You" are yours.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" className="h-11 print:hidden" onClick={() => window.print()}>
          <Printer />
          Print this guide
        </Button>
      </div>

      {SCHEDULE_GUIDE.map((part) => (
        <section key={part.title} aria-label={part.title} className="space-y-3">
          <div>
            <h2 className="font-semibold text-teal-700">{part.title}</h2>
            <p className="text-sm text-neutral-700">{part.intro}</p>
          </div>
          <ol className="space-y-3">
            {part.steps.map((step) => {
              const number = STEP_NUMBERS.get(step) ?? 0;
              const isMine = !!user?.role && step.roles.includes(user.role);

              return (
                <li
                  key={step.title}
                  className={`break-inside-avoid rounded-xl border bg-background p-4 shadow-sm ${isMine ? "border-[#790D16]/40" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isMine ? "bg-[#790D16] text-white" : "bg-neutral-200 text-neutral-800"
                      }`}
                      aria-hidden="true"
                    >
                      {number}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-neutral-900">
                          <span className="sr-only">Step {number}: </span>
                          {step.title}
                        </h3>
                        {isMine && <Badge className="bg-[#790D16]/10 text-branding">You</Badge>}
                        {step.roles.length === 1 && <Badge variant="secondary">Admin</Badge>}
                      </div>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-800">
                        {step.what.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      {step.tip && (
                        <p className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-950">
                          <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                          {step.tip}
                        </p>
                      )}
                      {step.where && isMine && (
                        <Link
                          to={step.where.to}
                          className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-branding hover:bg-[#790D16]/5 print:hidden"
                        >
                          Go to {step.where.label}
                          <ArrowRight className="size-4" />
                        </Link>
                      )}
                      {step.where && !isMine && (
                        <p className="text-xs text-neutral-600">Done on the {step.where.label} page.</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
};

export default ScheduleGuidePage;
