// @ts-check
/**
 * Report Settings (Admin): the school profile printed on every form (with logos and the campus
 * photo), each document's title and control block, and the signatories of each term. Names and
 * positions are typed here; none are written in code.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { confirmAction, setBusy } from "@/components/dialog.js";
import { openFormDialog } from "@/components/form-dialog.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { toast } from "@/components/toast.js";
import { api, errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { invalidate, watch } from "@/state/cache.js";
import { termState } from "@/state/term.js";

const REPORT_TYPES = { class_program: "Class Program", teacher_program: "Teacher Program", room_schedule: "Room Schedule" };
const DOCUMENTS = [
  { report_type: "class_program", level: "JHS", title: "Class Program (JHS)", defaultTitle: "{level} GRADE {grade} – CLASS PROGRAM" },
  { report_type: "class_program", level: "SHS", title: "Class Program (SHS)", defaultTitle: "{level} GRADE {grade} – CLASS PROGRAM" },
  { report_type: "teacher_program", level: null, title: "Teacher Program", defaultTitle: "TEACHER PROGRAM" },
  { report_type: "room_schedule", level: null, title: "Room Schedule", defaultTitle: "ROOM SCHEDULE" },
];
const AUTO_SOURCE = { class_program: { source: "section_adviser", label: "The section's class adviser" }, teacher_program: { source: "teacher", label: "The teacher on the form" } };
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

  /** Uploads a logo or the campus photo. */
  const upload = async (/** @type {"logos" | "photo"} */ kind, /** @type {File} */ file) => {
    const body = new FormData();
    body.append(kind === "logos" ? "logo" : "photo", file);
    await api(`/school-profile/${kind}`, { method: "POST", body });
    invalidate(["records"]);
    invalidate(["public"]);
  };

  const filePicker = (/** @type {string} */ label, /** @type {(file: File) => Promise<void>} */ onPick) => {
    const input = /** @type {HTMLInputElement} */ (h("input", { type: "file", accept: "image/png,image/jpeg", class: "hidden", "aria-label": label }));
    const button = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-outline", onclick: () => input.click() }, icon("file-up"), label));
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      setBusy(button, true, "Uploading...");
      try {
        await onPick(file);
        toast.success(`${file.name} was uploaded.`);
      } catch (error) {
        toast.error(error);
      } finally {
        setBusy(button, false);
      }
    });
    return h("span", null, input, button);
  };

  const profile = async () => {
    const settings = await getRecords("/report-settings");
    const school = settings.school ?? {};
    const edit = () =>
      openFormDialog({
        title: "Edit the school profile",
        description: "Printed in the header and footer of every form, and shown on the home page.",
        fields: [
          { name: "school_name", label: "School name", required: true, value: school.school_name, wide: true },
          { name: "school_id", label: "School ID", value: school.school_id ?? "" },
          { name: "region", label: "Region", value: school.region ?? "" },
          { name: "division", label: "Division", value: school.division ?? "" },
          { name: "address", label: "Address", value: school.address ?? "", wide: true },
          { name: "phone", label: "Phone", value: school.phone ?? "" },
          { name: "email", label: "Email", type: "email", value: school.email ?? "" },
          { name: "website", label: "Website", value: school.website ?? "" },
          { name: "facebook_url", label: "Facebook page", value: school.facebook_url ?? "" },
          { name: "tagline", label: "Tagline", value: school.tagline ?? "", wide: true },
          { name: "vision", label: "Vision", type: "textarea", value: school.vision ?? "", wide: true },
          { name: "mission", label: "Mission", type: "textarea", value: school.mission ?? "", wide: true },
          { name: "core_values", label: "Core values", type: "textarea", value: school.core_values ?? "", wide: true },
        ],
        submitLabel: "Save profile",
        onSubmit: async (values) => {
          await changeRecord("/school-profile", "PUT", Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === "school_name" ? value : nullable(value)])));
          invalidate(["public"]);
          return "The school profile was saved.";
        },
      });
    const logos = settings.logo_items ?? settings.logos.map((/** @type {string} */ src) => ({ src, placement: "header" }));
    replace(
      content,
      h("section", { class: "card space-y-3 p-4" },
        h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between" }, h("div", null, h("h2", { class: "text-lg font-semibold text-accent" }, school.school_name ?? "No school name yet"), h("p", { class: "text-small text-muted-foreground" }, [school.address, school.phone, school.email].filter(Boolean).join(" · ") || "No contact details yet")), h("button", { type: "button", class: "btn btn-primary", onclick: edit }, icon("pencil"), "Edit profile")),
      ),
      h("section", { class: "card space-y-3 p-4" },
        h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" }, h("div", null, h("h2", { class: "font-semibold text-accent" }, "Logos"), h("p", { class: "text-small text-muted-foreground" }, `Up to ${settings.max_logos}, printed in order. PNG or JPG.`)), logos.length < settings.max_logos ? filePicker("Upload a logo", (file) => upload("logos", file)) : null),
        logos.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "No logos yet.") : h("ul", { class: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" }, logos.map((/** @type {any} */ logo, /** @type {number} */ index) =>
          h("li", { class: "space-y-2 rounded-lg border p-3" },
            h("img", { src: logo.src, alt: `Logo ${index + 1}`, class: "mx-auto h-20 object-contain" }),
            h("div", { role: "group", "aria-label": `Where logo ${index + 1} is printed`, class: "grid grid-cols-2 gap-1" }, [["header", "Top"], ["footer", "Footer"]].map(([placement, label]) => h("button", { type: "button", "aria-pressed": String(logo.placement === placement), class: `btn border px-2 ${logo.placement === placement ? "border-brand bg-brand text-white" : "bg-surface"}`, onclick: async () => { try { await changeRecord(`/school-profile/logos/${index}/placement`, "PUT", { placement }); toast.success(`Logo ${index + 1} is printed at the ${label.toLowerCase()}.`); } catch (error) { toast.error(error); } } }, label))),
            h("button", { type: "button", class: "btn btn-outline w-full text-danger", onclick: async () => { if (!(await confirmAction({ title: `Remove logo ${index + 1}?`, message: "It is no longer printed on the forms.", confirmLabel: "Yes, remove" }))) return; try { await changeRecord(`/school-profile/logos/${index}`, "DELETE"); toast.success("The logo was removed."); } catch (error) { toast.error(error); } } }, icon("trash"), "Remove"),
          ),
        )),
      ),
      h("section", { class: "card space-y-3 p-4" },
        h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" }, h("div", null, h("h2", { class: "font-semibold text-accent" }, "Campus photo"), h("p", { class: "text-small text-muted-foreground" }, "Shown on the home page.")), h("div", { class: "flex flex-wrap gap-2" }, filePicker(school.has_photo ? "Replace the photo" : "Upload a photo", (file) => upload("photo", file)), school.has_photo ? h("button", { type: "button", class: "btn btn-outline text-danger", onclick: async () => { if (!(await confirmAction({ title: "Remove the campus photo?", message: "The home page shows the school logo instead.", confirmLabel: "Yes, remove" }))) return; try { await changeRecord("/school-profile/photo", "DELETE"); invalidate(["public"]); toast.success("The photo was removed."); } catch (error) { toast.error(error); } } }, icon("trash"), "Remove") : null)),
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
    const signatoryForm = (/** @type {any} */ signatory = null) =>
      openFormDialog({
        title: signatory ? `Edit ${signatory.label}` : "Add a signatory",
        description: `For ${term.name}. Signatories print in a 2×2 block, in this order.`,
        fields: [
          { name: "label", label: "Label", required: true, value: signatory?.label, help: "Like Prepared by, Conforme, Recommending Approval, Approved by" },
          { name: "report_type", label: "Form", type: "select", value: signatory?.report_type ?? "class_program", options: [{ value: "", label: "Every form" }, ...Object.entries(REPORT_TYPES).map(([value, label]) => ({ value, label }))] },
          { name: "level", label: "Department", type: "select", value: signatory?.level ?? "", options: [{ value: "", label: "Both" }, { value: "JHS", label: "Junior High" }, { value: "SHS", label: "Senior High" }] },
          { name: "auto_source", label: "Name filled in by the system", type: "select", value: signatory?.auto_source ?? "", options: [{ value: "", label: "No: type the name below" }, ...Object.values(AUTO_SOURCE).map(({ source, label }) => ({ value: source, label }))] },
          { name: "name", label: "Name", value: signatory?.name ?? "", help: "Leave empty when the system fills it in." },
          { name: "position", label: "Position", value: signatory?.position ?? "", help: "Like Head Teacher III" },
        ],
        submitLabel: signatory ? "Save changes" : "Add signatory",
        onSubmit: async (values) => {
          const body = { label: values.label, report_type: nullable(values.report_type), level: nullable(values.level), auto_source: nullable(values.auto_source), name: values.auto_source ? null : nullable(values.name), position: nullable(values.position) };
          await changeRecord(signatory ? `/signatories/${signatory.id}` : `/terms/${term.id}/signatories`, signatory ? "PUT" : "POST", body);
          return `${values.label} was ${signatory ? "saved" : "added"}.`;
        },
        remove: signatory ? { label: "Delete this signatory", message: `This removes ${signatory.label} from the forms of ${term.name}.`, run: async () => { await changeRecord(`/signatories/${signatory.id}`, "DELETE"); return `${signatory.label} was deleted.`; } } : undefined,
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
    const move = async (/** @type {any} */ signatory, /** @type {"up" | "down"} */ direction) => {
      try {
        await changeRecord(`/signatories/${signatory.id}/move`, "POST", { direction });
      } catch (error) {
        toast.error(error);
      }
    };
    replace(
      content,
      h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" }, h("p", { class: "text-sm text-muted-foreground" }, `Signatories of ${term.name}, SY ${term.school_year.name}.`), h("div", { class: "flex flex-wrap gap-2" }, list.length ? copyButton : null, h("button", { type: "button", class: "btn btn-primary", onclick: () => signatoryForm() }, icon("plus"), "Add signatory"))),
      list.length === 0
        ? emptyState({ title: "No signatories yet", text: "Add Prepared by, Conforme, Recommending Approval and Approved by." })
        : h("ol", { class: "card divide-y" }, list.map((/** @type {any} */ signatory, /** @type {number} */ index) =>
            h("li", { class: "flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between" },
              h("div", { class: "min-w-0 text-sm" }, h("p", { class: "font-medium" }, `${index + 1}. ${signatory.label}`), h("p", { class: "text-small text-muted-foreground" }, `${signatory.auto_source ? AUTO_SOURCE[/** @type {keyof typeof AUTO_SOURCE} */ (signatory.report_type)]?.label ?? "Filled in by the system" : signatory.name ?? "No name yet"}${signatory.position ? `, ${signatory.position}` : ""} · ${signatory.report_type ? REPORT_TYPES[/** @type {keyof typeof REPORT_TYPES} */ (signatory.report_type)] : "Every form"}${signatory.level ? ` (${signatory.level})` : ""}`)),
              h("div", { class: "flex flex-wrap gap-2" }, h("button", { type: "button", class: "btn btn-outline", disabled: index === 0, "aria-label": `Move ${signatory.label} up`, onclick: () => move(signatory, "up") }, "Up"), h("button", { type: "button", class: "btn btn-outline", disabled: index === list.length - 1, "aria-label": `Move ${signatory.label} down`, onclick: () => move(signatory, "down") }, "Down"), h("button", { type: "button", class: "btn btn-outline", "aria-label": `Edit ${signatory.label}`, onclick: () => signatoryForm(signatory) }, icon("pencil"), "Edit")),
            ),
          )),
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
