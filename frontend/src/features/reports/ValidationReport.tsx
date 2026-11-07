import { Link } from "react-router";
import { useValidationReport } from "@/api/reports";
import { STATUS_COLORS } from "@/lib/schedule";
import DownloadButtons from "@/components/global-component/DownloadButtons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** Every issue in the term, section by section, with a way to go and fix it. */
const ValidationReport = ({ termId }: { termId: number }) => {
  const { data, isPending, isError } = useValidationReport(termId);

  return (
    <div className="space-y-4">
      <DownloadButtons basePath={`/terms/${termId}/reports/validation`} label="Conflict and Validation Report" />

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}
      {isError && <p className="text-sm text-destructive">Could not load the report.</p>}

      {data && (
        <>
          <p className="text-sm text-neutral-800">
            <span className="font-medium">
              {data.summary.issues} {data.summary.issues === 1 ? "issue" : "issues"}
            </span>{" "}
            in {data.summary.sections_with_issues} of {data.summary.sections}{" "}
            {data.summary.sections === 1 ? "section" : "sections"}. {data.summary.urgent} urgent,{" "}
            {data.summary.not_acknowledged} not yet acknowledged.
          </p>

          {data.sections.length === 0 && (
            <p className="text-sm text-neutral-700">Nothing to check. Every section is clear.</p>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
            {data.sections.map((section) => (
              <Card key={section.id}>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/schedule/sections/${section.id}`}
                      className="flex min-h-11 items-center font-medium text-teal-700 underline-offset-2 hover:underline"
                    >
                      {section.label}
                    </Link>
                    <Badge className={STATUS_COLORS[section.status]}>{section.status_label}</Badge>
                  </div>
                  <ul className="divide-y">
                    {section.issues.map((issue, index) => (
                      <li key={index} className="flex items-start gap-2 py-2 text-sm">
                        <Badge
                          className={`shrink-0 ${
                            issue.severity === "red" ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {issue.level}
                        </Badge>
                        <span className="min-w-0 text-neutral-900">
                          {issue.message}
                          {issue.acknowledged && <span className="text-neutral-600"> (acknowledged)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ValidationReport;
