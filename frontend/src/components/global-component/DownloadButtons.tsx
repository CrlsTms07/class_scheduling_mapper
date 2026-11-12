import React from "react";
import { Download } from "lucide-react";
import { downloadFile } from "@/api/client";
import { apiErrorMessage } from "@/lib/forms";
import FormAlert from "@/components/global-component/FormAlert";
import { Button } from "@/components/ui/button";

export type DownloadFormat = "pdf" | "xlsx" | "csv";

type DownloadButtonsProp = {
  /** The file's path without its extension. */
  basePath: string;
  label: string;
  formats?: readonly DownloadFormat[];
};

/**
 * Download buttons, which report a failed download where the user is looking.
 * PDF is the official form, XLSX the spreadsheet, CSV the raw data.
 */
const DownloadButtons = ({ basePath, label, formats = ["pdf", "xlsx", "csv"] }: DownloadButtonsProp) => {
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  const download = (extension: DownloadFormat) => {
    setError(null);
    setSaving(extension);
    downloadFile(`${basePath}.${extension}`)
      .catch((failure: unknown) => setError(apiErrorMessage(failure)))
      .finally(() => setSaving(null));
  };

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 sm:flex ${formats.length > 2 ? "grid-cols-3" : formats.length > 1 ? "grid-cols-2" : ""}`}>
        {formats.map((extension) => (
          <Button
            key={extension}
            type="button"
            variant="outline"
            className="h-11"
            aria-label={`Download ${label} as ${extension.toUpperCase()}`}
            disabled={saving !== null}
            onClick={() => download(extension)}
          >
            <Download />
            {saving === extension ? "Preparing..." : extension.toUpperCase()}
          </Button>
        ))}
      </div>
      {error && <FormAlert>{error}</FormAlert>}
    </div>
  );
};

export default DownloadButtons;
