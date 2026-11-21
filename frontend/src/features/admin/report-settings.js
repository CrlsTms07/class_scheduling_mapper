// @ts-check
/**
 * Report Settings (Admin): the school profile printed on every form, each document's title and
 * control block, and the four signatories of each term (team decisions, Nov 21, 2026):
 * - The school's name, ID, region, division, address and logo are built into the system; the Admin
 *   only keeps the phone, email and Facebook page up to date. Nothing is uploaded.
 * - The signatories are the same 2×2 block on every form: Prepared by, Conforme (the section's
 *   adviser, filled in by the system), Recommending Approval and Approved by. Names and positions
 *   are typed here; none are written in code.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { confirmAction, setBusy } from "@/components/dialog.js";
import { openFormDialog } from "@/components/form-dialog.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { invalidate, watch } from "@/state/cache.js";
import { termState } from "@/state/term.js";

const DOCUMENTS = [
  { report_type: "class_program", level: "JHS", title: "Class Program (JHS)", defaultTitle: "{level} GRADE {grade} – CLASS PROGRAM" },
  { report_type: "class_program", level: "SHS", title: "Class Program (SHS)", defaultTitle: "{level} GRADE {grade} – CLASS PROGRAM" },
  { report_type: "teacher_program", level: null, title: "Teacher Program", defaultTitle: "TEACHER PROGRAM" },
  { report_type: "room_schedule", level: null, title: "Room Schedule", defaultTitle: "ROOM SCHEDULE" },
];
const TABS = [["profile", "School profile"], ["documents", "Documents"], ["signatories", "Signatories"]];

/** @type {import("@/router.js").RenderPage} */
export async function render(container, { query, navigate }) {
  const tab = TABS.some(([key]) => key === query.get("tab")) ? String(query.get("tab")) : "profile";
  const term = termState.term;
  const content = h("div", { class: "space-y-4" }, skeletonList(3));
  const nullable = (/** @type {any} */ value) => (value === "" || value === undefined ? null : value);

  replace(
    container,
    h(
      "div",
      { class: "space-y-5 p-4 sm:p-6" },
      pageHeader({ icon: "file-cog", title: "Report Settings", description: "What every printed form shows: the school, the titles and the signatories.", crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Report Settings" }] }),
      h("div", { role: "tablist", "aria-label": "Settings", class: "grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-1 sm:w-fit" }, TABS.map(([key, label]) => h("button", { type: "button", role: "tab", "aria-selected": String(tab === key), class: `btn whitespace-normal px-2 leading-tight ${tab === key ? "bg-surface shadow-sm" : "text-muted-foreground"}`, onclick: () => navigate(`/report-settings?tab=${key}`) }, label))),
      content,
    ),
  );

  const profile = async () => {
    const settings = await getRecords("/report-settings");
    const school = settings.school;
    const edit = () =>
      openFormDialog({
        title: "School contact details",
        description: "The school's name, ID, region, division, address and logo are built into the system. Only these can change.",
        fields: [
          { name: "phone", label: "Phone", required: true, value: school.phone ?? "", help: "Like (046) 894-1463", check: (value) => (/^[0-9()+\-/ ]{7,}$/.test(value.trim()) ? null : "Write the phone number with digits, like (046) 894-1463.") },
          { name: "email", label: "Email", type: "email", required: true, value: school.email ?? "" },
          { name: "facebook_url", label: "Facebook page", required: true, value: school.facebook_url ?? "", wide: true, help: "The link of the school's page, like https://www.facebook.com/DepEdTayoERCIHS301179", check: (value) => (/^https?:\/\/(www\.|m\.)?facebook\.com\//i.test(value.trim()) ? null : "Use the link of the school's Facebook page, starting with https://www.facebook.com/") },
        ],
        submitLabel: "Save",
        onSubmit: async (values) => {
          await changeRecord("/school-profile", "PUT", { phone: values.phone.trim(), email: values.email.trim(), facebook_url: values.facebook_url.trim() });
          invalidate(["public"]);
          return "The school's contact details were saved.";
        },
      });
    const row = (/** @type {string} */ label, /** @type {string | null} */ value) => [h("dt", { class: "text-muted-foreground" }, label), h("dd", { class: "font-medium" }, value || "–")];
    replace(
      content,
      h("section", { class: "card space-y-4 p-4" },
        h("div", { class: "flex flex-col gap-3 sm:flex-row sm:items-start" },
          h("img", { src: school.logo, alt: "School logo", class: "size-20 shrink-0 object-contain" }),
          h("div", { class: "min-w-0 flex-1" },
            h("h2", { class: "text-lg font-semibold text-accent" }, school.school_name),
            h("p", { class: "text-small text-muted-foreground" }, "Built into the system: printed on every form and shown on the home page. No upload is needed."),
          ),
        ),
        h("dl", { class: "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" }, row("School ID", school.school_id), row("Region", school.region), row("Division", school.division), row("Address", school.address)),
      ),
      h("section", { class: "card space-y-3 p-4" },
        h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between" },
          h("div", null, h("h2", { class: "font-semibold text-accent" }, "Contact details"), h("p", { class: "text-small text-muted-foreground" }, "Printed in the footer of the forms.")),
          h("button", { type: "button", class: "btn btn-primary", onclick: edit }, icon("pencil"), "Edit"),
        ),
        h("dl", { class: "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" }, row("Phone", school.phone), row("Email", school.email), row("Facebook page", school.facebook_url)),
      ),
    );
  };

  const documents = async () => {
    const settings = await getRecords("/report-settings");
    replace(content, h("div", { class: "grid gap-4 lg:grid-cols-2" }, DOCUMENTS.map((document) => {
      const saved = settings.documents.find((/** @type {any} */ item) => item.report_type === document.report_type && item.level === document.level);
      const edit = () =>
        openFormDialog({
          title: document.title,
          description: "{level} and {grade} in the title are filled in for each form.",
          fields: [
            { name: "title_format", label: "Title", required: true, value: saved?.title_format ?? document.defaultTitle, wide: true },
            { name: "reference_note", label: "Reference note", value: saved?.reference_note ?? "", help: "Like DO 12, s. 2024", wide: true },
            { name: "doc_ref_code", label: "Doc. Ref. Code", value: saved?.doc_ref_code ?? "" },
            { name: "revision_no", label: "Rev.", value: saved?.revision_no ?? "" },
            { name: "effectivity_date", label: "Effectivity", type: "date", value: saved?.effectivity_date ?? "" },
          ],
          submitLabel: "Save",
          onSubmit: async (values) => {
            await changeRecord("/report-settings/documents", "PUT", { report_type: document.report_type, level: document.level, title_format: values.title_format, doc_ref_code: nullable(values.doc_ref_code), revision_no: nullable(values.revision_no), effectivity_date: nullable(values.effectivity_date), reference_note: nullable(values.reference_note) });
            return `${document.title} was saved.`;
          },
        });
      return h("section", { class: "card space-y-2 p-4" },
        h("div", { class: "flex items-start justify-between gap-2" }, h("h2", { class: "font-semibold text-accent" }, document.title), h("button", { type: "button", class: "btn btn-outline", "aria-label": `Edit ${document.title}`, onclick: edit }, icon("pencil"), "Edit")),
        h("dl", { class: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm" }, [["Title", saved?.title_format ?? document.defaultTitle], ["Reference", saved?.reference_note], ["Doc. Ref.", saved?.doc_ref_code], ["Rev.", saved?.revision_no], ["Effectivity", saved?.effectivity_date]].flatMap(([label, value]) => [h("dt", { class: "text-muted-foreground" }, label), h("dd", null, value || "–")])),
      );
    })));
  };

  const signatories = async () => {
    if (!term) {
      replace(content, emptyState({ title: "No school year yet", text: "Signatories are kept per term. Start a school year first." }));
      return;
    }
    const list = await getRecords(`/terms/${term.id}/signatories`);
    const saved = (/** @type {string} */ label) => list.find((/** @type {any} */ item) => item.label === label);
    const SLOTS = [
      { key: "prepared_by", label: "Prepared by", example: "Head Teacher III" },
      { key: "conforme", label: "Conforme", auto: true },
      { key: "recommending_approval", label: "Recommending Approval", example: "School Principal II" },
      { key: "approved_by", label: "Approved by", example: "PSDS Cluster IV" },
    ];
    const typed = SLOTS.filter((slot) => !slot.auto);
    const edit = () =>
      openFormDialog({
        title: "Signatories",
        description: `For ${term.name}. Conforme is the section's class adviser, filled in by the system.`,
        fields: typed.flatMap((slot) => [
          { name: `${slot.key}__name`, label: `${slot.label}: name`, required: true, value: saved(slot.label)?.name ?? "" },
          { name: `${slot.key}__position`, label: `${slot.label}: position`, required: true, value: saved(slot.label)?.position ?? "", help: `Like ${slot.example}` },
        ]),
        submitLabel: "Save signatories",
        onSubmit: async (values) => {
          const body = Object.fromEntries(typed.map((slot) => [slot.key, { name: values[`${slot.key}__name`].trim(), position: values[`${slot.key}__position`].trim() }]));
          await changeRecord(`/terms/${term.id}/signatories/slots`, "PUT", body);
          return `The signatories of ${term.name} were saved.`;
        },
      });
    const copyButton = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-outline", onclick: async () => {
      if (!(await confirmAction({ title: "Use these for every term?", message: `The signatories of ${term.name} replace those of the other terms of SY ${term.school_year.name}.`, confirmLabel: "Yes, copy them", danger: false }))) return;
      setBusy(copyButton, true, "Copying...");
      try {
        const reply = await changeRecord(`/terms/${term.id}/signatories/copy`, "POST");
        toast.success(`Copied to ${reply.data.terms} other ${reply.data.terms === 1 ? "term" : "terms"}.`);
      } catch (error) {
        toast.error(error);
      } finally {
        setBusy(copyButton, false);
      }
    } }, icon("copy"), "Use for every term"));
    const isSet = typed.every((slot) => saved(slot.label)?.name);
    replace(
      content,
      h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" },
        h("p", { class: "text-sm text-muted-foreground" }, `The signature block of ${term.name}, SY ${term.school_year.name}, as it prints on the forms.`),
        h("div", { class: "flex flex-wrap gap-2" }, isSet ? copyButton : null, h("button", { type: "button", class: "btn btn-primary", onclick: edit }, icon("pencil"), isSet ? "Edit signatories" : "Set the signatories")),
      ),
      // The same 2×2 block as on the printed form.
      h("div", { class: "grid gap-3 sm:grid-cols-2" }, SLOTS.map((slot) => {
        const item = saved(slot.label);
        return h("section", { class: "card space-y-1 p-4", "aria-label": slot.label },
          h("p", { class: "text-small text-muted-foreground" }, slot.label),
          slot.auto
            ? [h("p", { class: "font-semibold" }, "The section's class adviser"), h("p", { class: "text-sm text-muted-foreground" }, "Class Adviser · filled in by the system")]
            : item?.name
              ? [h("p", { class: "font-semibold uppercase" }, item.name), h("p", { class: "text-sm text-muted-foreground" }, item.position ?? "")]
              : h("p", { class: "text-sm text-danger" }, "Not set yet"),
        );
      })),
    );
  };

  const panels = { profile, documents, signatories };
  const draw = async () => {
    try {
      await panels[/** @type {keyof typeof panels} */ (tab)]();
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };
  const stop = watch(["records"], draw);
  await draw();
  return stop;
}
