import React from "react";
import { FileCog } from "lucide-react";
import { useReportSettings } from "@/api/reportSettings";
import DocumentsPanel from "./DocumentsPanel";
import SchoolProfilePanel from "./SchoolProfilePanel";
import SignatoriesPanel from "./SignatoriesPanel";

const TABS = [
  { key: "school", label: "School Profile" },
  { key: "documents", label: "Documents" },
  { key: "signatories", label: "Signatories" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const HOW_IT_WORKS = [
  "School Profile: the school's details and logos, printed in the header and footer of every form.",
  "Documents: the title and document control block (Doc. Ref. Code, Revision, Effectivity) of each form.",
  "Signatories: who signs each form. Names are typed here, except names the system can fill by itself, like the class adviser.",
];

const ReportSettingsIndex = () => {
  const { data: settings, isPending, isError } = useReportSettings();
  const [tab, setTab] = React.useState<TabKey>("school");

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#790D16]/20 rounded-sm">
          <FileCog className="text-branding size-5" />
        </div>
        <div>
          <p className="text-branding text-xl font-medium">Report Settings</p>
          <p className="text-sm text-neutral-700">What the printed forms are made from.</p>
        </div>
      </div>

      <details className="rounded-md border bg-background">
        <summary className="flex min-h-11 cursor-pointer items-center p-3 text-sm font-medium">
          How this works
        </summary>
        <ul className="list-disc space-y-1 px-3 pb-3 pl-8 text-sm text-neutral-700">
          {HOW_IT_WORKS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      <div role="tablist" aria-label="Report settings" className="grid grid-cols-3 gap-2 sm:max-w-xl">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === tab}
            onClick={() => setTab(key)}
            className={`min-h-11 rounded-md border px-1 text-xs sm:text-sm font-medium ${
              key === tab
                ? "bg-[#790D16] text-white border-[#790D16]"
                : "bg-background text-neutral-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the settings.</p>}

      {settings && tab === "school" && <SchoolProfilePanel settings={settings} />}
      {settings && tab === "documents" && <DocumentsPanel documents={settings.documents} />}
      {tab === "signatories" && <SignatoriesPanel />}
    </div>
  );
};

export default ReportSettingsIndex;
