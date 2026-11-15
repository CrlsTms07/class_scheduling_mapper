import { CircleCheck, Circle } from "lucide-react";
import { nextSubject, remainingHint, subjectsDone, type PlotContext } from "@/lib/schedule";
import type { Loading } from "@/types/api";

const STEPS = [
  "Tap a subject in the list. On a phone, tap an empty period and choose the subject there.",
  "Tap the empty periods where it belongs, or drag the subject onto them. Junior High fills the whole bell schedule at once. Senior High fills one day at a time.",
  "Watch the minutes on each subject until it says Complete. A conflict is never saved, and the system tells you who or what clashes.",
  "To move a class, drag it to another period. To change or remove one, tap it.",
  "When every subject is complete, check the flags and press Submit for approval. The Admin approves it, and only then can teachers and guests see it.",
];

type PlotterGuideProp = PlotContext & { loading: Loading[] };

/** Says what to do next, and how far the section has come. */
const PlotterGuide = ({ loading, ...context }: PlotterGuideProp) => {
  const done = subjectsDone(loading);
  const next = nextSubject(loading);
  const percent = loading.length === 0 ? 0 : Math.round((done / loading.length) * 100);

  return (
    <div className="space-y-3">
      <details className="rounded-md border bg-background">
        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm font-medium">
          How this works
        </summary>
        <ol className="list-decimal space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>

      <div className="space-y-2 rounded-md border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-medium text-neutral-900">
            {done} of {loading.length} {loading.length === 1 ? "subject" : "subjects"} complete
          </p>
          <p className="text-neutral-700">
            {next
              ? `Next: ${next.subject}. ${remainingHint(next, context)}`
              : "All subjects are placed. Check the flags, then submit for approval."}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Subjects complete"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 overflow-hidden rounded-full bg-neutral-200"
        >
          <div className="h-full rounded-full bg-teal-700" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* Phones in portrait have no subject panel, so the list is here. */}
      <details className="hidden rounded-md border bg-background max-md:portrait:block">
        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm font-medium">
          See all subjects
        </summary>
        <ul className="divide-y border-t">
          {loading.map((item) => (
            <li key={item.id} className="flex items-start gap-2 p-3 text-sm">
              {item.scheduled_minutes === item.required_minutes ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-neutral-400" />
              )}
              <span className="min-w-0">
                <span className="block font-medium text-neutral-900">{item.subject}</span>
                <span className="block text-xs text-neutral-700">{item.teacher}</span>
                <span className="block text-xs text-neutral-700">{remainingHint(item, context)}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
};

export default PlotterGuide;
