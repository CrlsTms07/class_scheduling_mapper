import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useSaveDocument } from "@/api/reportSettings";
import { apiErrorMessage } from "@/lib/forms";
import {
  DocumentSchema,
  DOCUMENTS,
  emptyToNull,
  toDocumentForm,
  type DocumentValues,
} from "@/lib/reportSettings";
import type { DocumentSetting } from "@/types/api";
import FormAlert from "@/components/global-component/FormAlert";
import FormTextField from "@/components/global-component/FormTextField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DocumentCardProp = {
  document: (typeof DOCUMENTS)[number];
  saved: DocumentSetting | undefined;
};

const DocumentCard = ({ document, saved }: DocumentCardProp) => {
  const save = useSaveDocument();
  const [isSaved, setIsSaved] = React.useState(false);
  const prefix = `${document.report_type}-${document.level ?? "all"}-`;
  const form = useForm<DocumentValues>({
    resolver: zodResolver(DocumentSchema),
    defaultValues: toDocumentForm(saved, document.defaultTitle),
  });

  const handleSave = form.handleSubmit((values) => {
    setIsSaved(false);
    save.mutate(
      {
        report_type: document.report_type,
        level: document.level,
        title_format: values.title_format,
        doc_ref_code: emptyToNull(values.doc_ref_code),
        revision_no: emptyToNull(values.revision_no),
        effectivity_date: emptyToNull(values.effectivity_date),
        reference_note: emptyToNull(values.reference_note),
      },
      { onSuccess: () => setIsSaved(true) },
    );
  });

  return (
    <Card className="shadow shadow-[#790D16]/40">
      <CardContent>
        <form noValidate className="space-y-4" onSubmit={handleSave} aria-label={document.title}>
          <p className="font-medium text-teal-700">{document.title}</p>
          {save.isError && <FormAlert>{apiErrorMessage(save.error)}</FormAlert>}
          {isSaved && <FormAlert variant="success">{document.title} was saved.</FormAlert>}
          <FormTextField control={form.control} idPrefix={prefix} name="title_format" label="Title" />
          <div className="grid grid-cols-2 gap-3">
            <FormTextField control={form.control} idPrefix={prefix} name="doc_ref_code" label="Doc. Ref. Code" />
            <FormTextField control={form.control} idPrefix={prefix} name="revision_no" label="Revision" />
          </div>
          <FormTextField
            control={form.control}
            idPrefix={prefix}
            name="effectivity_date"
            label="Effectivity date"
            type="date"
          />
          <FormTextField
            control={form.control}
            idPrefix={prefix}
            name="reference_note"
            label="Reference notes (separate lines with ;)"
            placeholder="DO 10, s. 2024; DO 12, s. 2024"
          />
          <Button type="submit" className="h-11 w-full" disabled={save.isPending}>
            {save.isPending ? "Saving..." : `Save ${document.title}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

/** The title and document control block of each printed form. */
const DocumentsPanel = ({ documents }: { documents: DocumentSetting[] }) => (
  <div className="space-y-4">
    <p className="text-sm text-neutral-700">
      In a title, {"{level}"} prints JHS or SHS and {"{grade}"} prints the grade level.
    </p>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      {DOCUMENTS.map((document) => (
        <DocumentCard
          key={`${document.report_type}-${document.level}`}
          document={document}
          saved={documents.find(
            ({ report_type, level }) =>
              report_type === document.report_type && level === document.level,
          )}
        />
      ))}
    </div>
  </div>
);

export default DocumentsPanel;
