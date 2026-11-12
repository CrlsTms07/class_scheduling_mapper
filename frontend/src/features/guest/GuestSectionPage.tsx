import React from "react";
import { ArrowLeft, Link2, Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useParams } from "react-router";
import { useGuestSection } from "@/api/guest";
import { ApiError } from "@/api/client";
import { blocksFromGuestWeek, weekFromGuestWeek } from "@/lib/weekGrid";
import DownloadButtons from "@/components/global-component/DownloadButtons";
import FormAlert from "@/components/global-component/FormAlert";
import WeekView from "@/components/global-component/WeekView";
import { Button, buttonVariants } from "@/components/ui/button";

const WAITING_MESSAGE = {
  updating: "Schedule is being updated",
  not_ready: "This schedule is not ready yet",
};

/** Public, with a link that can be shared. Shows a section only when all of it is approved. */
const GuestSectionPage = () => {
  const sectionId = Number(useParams().sectionId);
  const { data, isPending, error } = useGuestSection(sectionId);
  const [copyResult, setCopyResult] = React.useState<"copied" | "failed" | null>(null);
  const [isQrOpen, setIsQrOpen] = React.useState(false);

  const copyLink = () => {
    // The clipboard is not available on every browser or on plain http.
    (navigator.clipboard?.writeText(window.location.href) ?? Promise.reject(new Error("No clipboard")))
      .then(() => setCopyResult("copied"))
      .catch(() => setCopyResult("failed"));
  };

  return (
    <div className="mx-auto min-h-dvh max-w-6xl space-y-4 p-4 sm:p-6 print:p-0">
      <Link
        to="/guest"
        className={buttonVariants({ variant: "link", className: "h-11 px-0 text-xs print:hidden" })}
      >
        <ArrowLeft />
        All sections
      </Link>

      {isPending && <p className="text-sm text-neutral-600">Loading...</p>}

      {error && (
        <FormAlert>
          {error instanceof ApiError && error.status === 404
            ? "This schedule could not be found. The link may be from another school year."
            : "This schedule could not be loaded. Please try again later."}
        </FormAlert>
      )}

      {data && (
        <>
          <div>
            <h1 className="text-branding text-xl font-medium">{data.label}</h1>
            <p className="text-sm text-neutral-700">
              {data.term.name}, SY {data.term.school_year}
            </p>
            {data.state === "ready" && data.adviser && (
              <p className="text-sm text-neutral-700">Class Adviser: {data.adviser}</p>
            )}
            {data.state === "ready" && data.co_adviser && (
              <p className="text-sm text-neutral-700">Co-Adviser: {data.co_adviser}</p>
            )}
          </div>

          {data.state !== "ready" && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <p className="font-medium">{WAITING_MESSAGE[data.state]}</p>
              <p className="text-sm">Please check again once the school has approved it.</p>
            </div>
          )}

          {data.state === "ready" && (
            <>
              <div className="space-y-2 print:hidden">
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button type="button" variant="outline" className="h-11" onClick={() => window.print()}>
                    <Printer />
                    Print
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={copyLink}>
                    <Link2 />
                    {copyResult === "copied" ? "Link copied" : "Copy link"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    aria-expanded={isQrOpen}
                    onClick={() => setIsQrOpen((open) => !open)}
                  >
                    <QrCode />
                    QR code
                  </Button>
                  <DownloadButtons
                    basePath={`/guest/sections/${sectionId}/class-program`}
                    label={`Class Program of ${data.label}`}
                    formats={["pdf"]}
                  />
                </div>
                {copyResult === "failed" && (
                  <p className="text-sm break-all text-neutral-800">Copy this link: {window.location.href}</p>
                )}
              </div>

              {isQrOpen && (
                <div className="flex w-fit flex-col items-center gap-2 rounded-md border bg-white p-4">
                  <div role="img" aria-label={`QR code for the schedule of ${data.label}`}>
                    <QRCodeSVG value={window.location.href} size={180} marginSize={2} />
                  </div>
                  <p className="text-center text-xs text-neutral-700">Scan to open this schedule.</p>
                </div>
              )}

              <WeekView week={weekFromGuestWeek(data.week)} blocks={blocksFromGuestWeek(data.week)} />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GuestSectionPage;
