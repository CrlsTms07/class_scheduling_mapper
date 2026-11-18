// @ts-check
/**
 * Users & Roles (Admin): sign-ups waiting to be activated (one by one, or "Activate selected as
 * Teacher"), each account's role, grade levels and teacher record, a temporary password with a
 * required change, and deactivate, reactivate or delete.
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { confirmAction, openDialog, setBusy } from "@/components/dialog.js";
import { dataList } from "@/components/data-list.js";
import { skeletonList } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { toast } from "@/components/toast.js";
import { errorMessage } from "@/api/client.js";
import { changeRecord, getRecords } from "@/api/records.js";
import { watch } from "@/state/cache.js";
import { session } from "@/state/session.js";
import { ROLE_LABELS } from "@/lib/navigation.js";

/** Which grade levels each scheduler role may be given. */
const ROLE_LEVEL = /** @type {Record<string, "JHS" | "SHS" | undefined>} */ ({ glc: "JHS", master_teacher: "SHS" });
const STATUS = { pending: "Waiting", active: "Active", inactive: "Inactive" };
const STATUS_TONE = { pending: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100", active: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100", inactive: "bg-surface-muted text-muted-foreground" };

/** @type {import("@/router.js").RenderPage} */
export async function render(container) {
  const ui = { search: "", status: "" };
  const content = h("div", { class: "space-y-5" }, skeletonList(5));
  /** @type {any} */
  let access = { grade_levels: [], teachers: [] };

  const fullName = (/** @type {any} */ user) => `${user.first_name} ${user.last_name}`;

  /** What the Admin does with one account. */
  const accountDialog = async (/** @type {any} */ user) => {
    access = await getRecords("/users/access-options");
    const isSelf = user.id === session.user?.id;
    const state = { role: user.role ?? "", grades: new Set(user.grade_levels.map((/** @type {any} */ grade) => grade.id)), teacherId: user.personnel?.id ?? user.matching_personnel?.id ?? null };
    const levelArea = h("div");
    const drawLevels = () => {
      const level = ROLE_LEVEL[state.role];
      if (!level) {
        replace(levelArea);
        return;
      }
      replace(
        levelArea,
        h("fieldset", { class: "space-y-2" }, h("legend", { class: "field-label" }, "Grade levels (their scope)"), h("div", { class: "flex flex-wrap gap-2" }, access.grade_levels.filter((/** @type {any} */ grade) => grade.level === level).map((/** @type {any} */ grade) => {
          const button = h("button", { type: "button", "aria-pressed": String(state.grades.has(grade.id)), class: `btn border ${state.grades.has(grade.id) ? "border-brand bg-brand text-white" : "bg-surface"}`, onclick: () => { state.grades.has(grade.id) ? state.grades.delete(grade.id) : state.grades.add(grade.id); drawLevels(); } }, `Grade ${grade.grade}`);
          return button;
        }))),
      );
    };
    const save = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", onclick: async () => {
      if (!state.role) {
        toast.error("Choose a role.");
        return;
      }
      const level = ROLE_LEVEL[state.role];
      const gradeIds = level ? [...state.grades].filter((id) => access.grade_levels.some((/** @type {any} */ grade) => grade.id === id && grade.level === level)) : [];
      if (level && gradeIds.length === 0) {
        toast.error("Choose at least one grade level.");
        return;
      }
      setBusy(save, true);
      try {
        await changeRecord(`/users/${user.id}/activation`, "PUT", { role: state.role, grade_level_ids: gradeIds, teacher_id: state.role !== "super_admin" || user.personnel ? state.teacherId : null });
        toast.success(user.status === "pending" ? `${fullName(user)} can now sign in as ${ROLE_LABELS[/** @type {keyof typeof ROLE_LABELS} */ (state.role)]}.` : `${fullName(user)}'s access was saved.`);
        close();
      } catch (error) {
        toast.error(error);
        setBusy(save, false);
      }
    } }, user.status === "pending" ? "Activate" : "Save access"));

    const resetArea = h("div");
    const resetButton = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-outline", onclick: async () => {
      const isSure = await confirmAction({ title: "Give a temporary password?", message: `${fullName(user)} is signed out everywhere and must choose a new password at the next sign-in.`, confirmLabel: "Yes, give one", danger: false });
      if (!isSure) return;
      setBusy(resetButton, true);
      try {
        const reply = await changeRecord(`/users/${user.id}/reset-password`, "POST");
        replace(resetArea, h("div", { role: "status", class: "space-y-1 rounded-lg border border-success/40 bg-success/5 p-3 text-sm" }, h("p", null, reply.message), h("p", { class: "font-mono text-lg font-bold tracking-wider" }, reply.temporary_password), h("p", { class: "field-help" }, "Give it to them in person. It is shown only once.")));
        toast.success("A temporary password was made.");
      } catch (error) {
        toast.error(error);
      } finally {
        setBusy(resetButton, false);
      }
    } }, icon("lock"), "Give a temporary password"));

    const statusAction = async (/** @type {"active" | "inactive"} */ status) => {
      if (status === "inactive" && !(await confirmAction({ title: `Deactivate ${fullName(user)}?`, message: "They are signed out and cannot sign in until reactivated. Their records stay.", confirmLabel: "Yes, deactivate" }))) return;
      try {
        await changeRecord(`/users/${user.id}/status`, "PUT", { status });
        toast.success(`${fullName(user)} was ${status === "active" ? "reactivated" : "deactivated"}.`);
        close();
      } catch (error) {
        toast.error(error);
      }
    };

    const removeAccount = async () => {
      const isPending = user.status === "pending";
      if (!(await confirmAction({ title: isPending ? "Decline this sign-up?" : `Delete ${fullName(user)}?`, message: isPending ? "The sign-up is removed. They can sign up again." : "The account is removed. Their teacher record stays.", confirmLabel: isPending ? "Yes, decline" : "Yes, delete" }))) return;
      try {
        await changeRecord(`/users/${user.id}`, "DELETE");
        toast.success(isPending ? "The sign-up was declined." : `${fullName(user)} was deleted.`);
        close();
      } catch (error) {
        toast.error(error);
      }
    };

    const { close } = openDialog({
      title: fullName(user),
      description: `${user.email} · ${STATUS[/** @type {keyof typeof STATUS} */ (user.status)]}`,
      body: h(
        "div",
        { class: "space-y-4" },
        user.status === "inactive"
          ? h("p", { class: "rounded-lg bg-surface-muted p-3 text-sm" }, `This account is inactive. Reactivate it to give back the same role and grade levels${user.role ? ` (${ROLE_LABELS[/** @type {keyof typeof ROLE_LABELS} */ (user.role)]})` : ""}.`)
          : [
              searchableSelect({ label: "Role", value: state.role, disabled: isSelf, options: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })), onChange: (value) => { state.role = String(value); state.grades.clear(); drawLevels(); } }),
              levelArea,
              searchableSelect({ label: "Teacher record (for My Schedule)", value: state.teacherId ?? "", options: [{ value: "", label: "None" }, ...access.teachers.map((/** @type {any} */ teacher) => ({ value: teacher.id, label: `${teacher.first_name} ${teacher.last_name}` }))], help: user.matching_personnel && !user.personnel ? `Found on the teachers list: ${user.matching_personnel.name}.` : "Links the account to its personnel record.", onChange: (value) => { state.teacherId = value ? Number(value) : null; } }),
            ],
        user.status === "active" && !isSelf ? h("div", { class: "space-y-2 border-t pt-4" }, resetButton, resetArea) : null,
        isSelf ? h("p", { class: "field-help" }, "This is your own account: its role cannot be changed here.") : null,
      ),
      footer: [
        !isSelf && user.status === "active" ? h("button", { type: "button", class: "btn btn-outline text-danger sm:mr-auto", onclick: () => statusAction("inactive") }, "Deactivate") : null,
        !isSelf && user.status !== "active" ? h("button", { type: "button", class: "btn btn-outline text-danger sm:mr-auto", disabled: !!user.cannot_delete_reason, title: user.cannot_delete_reason ?? undefined, onclick: removeAccount }, icon("trash"), user.status === "pending" ? "Decline" : "Delete") : null,
        h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"),
        user.status === "inactive" ? h("button", { type: "button", class: "btn btn-primary", onclick: () => statusAction("active") }, "Reactivate") : isSelf ? null : save,
      ],
    });
    drawLevels();
  };

  const searchInput = /** @type {HTMLInputElement} */ (h("input", { type: "search", class: "input", placeholder: "Name or email", "aria-label": "Search users", oninput: () => { ui.search = searchInput.value; draw(); } }));

  replace(container, h("div", { class: "space-y-5 p-4 sm:p-6" }, pageHeader({ icon: "users", title: "Users & Roles", description: "Who may sign in, with which role and grade levels.", crumbs: [{ label: "Home", to: "/dashboard" }, { label: "Users & Roles" }] }), content));

  const draw = async () => {
    try {
      const [users, loaded] = await Promise.all([getRecords("/users"), getRecords("/users/access-options")]);
      access = loaded;
      const pending = users.filter((/** @type {any} */ user) => user.status === "pending");
      const chosen = new Set();
      const bulk = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", disabled: true, onclick: async () => {
        setBusy(bulk, true, "Activating...");
        try {
          const reply = await changeRecord("/users/activate-teachers", "POST", { user_ids: [...chosen] });
          toast.success(reply.message);
        } catch (error) {
          toast.error(error);
          setBusy(bulk, false);
        }
      } }, icon("check"), "Activate selected as Teacher"));

      const words = ui.search.trim().toLowerCase();
      const shown = users.filter((/** @type {any} */ user) => (!ui.status || user.status === ui.status) && (!words || `${fullName(user)} ${user.email}`.toLowerCase().includes(words)));

      replace(
        content,
        pending.length
          ? h("section", { "aria-label": "Sign-ups waiting", class: "card space-y-3 p-4" },
              h("div", { class: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" }, h("div", null, h("h2", { class: "font-semibold text-accent" }, `Sign-ups waiting (${pending.length})`), h("p", { class: "text-small text-muted-foreground" }, "Check the ones to activate as Teachers, or open one to give another role.")), bulk),
              h("ul", { class: "divide-y rounded-lg border" }, pending.map((/** @type {any} */ user) => h("li", { class: "flex items-center justify-between gap-2 p-2" },
                h("label", { class: "flex min-h-11 min-w-0 items-center gap-3 text-sm" }, h("input", { type: "checkbox", class: "size-5 shrink-0 accent-[var(--brand)]", onchange: (/** @type {Event} */ event) => { /** @type {HTMLInputElement} */ (event.target).checked ? chosen.add(user.id) : chosen.delete(user.id); bulk.disabled = chosen.size === 0; } }), h("span", { class: "min-w-0" }, h("span", { class: "block font-medium" }, fullName(user)), h("span", { class: "block truncate text-small text-muted-foreground" }, `${user.email}${user.matching_personnel ? ` · on the teachers list` : ""}`))),
                h("button", { type: "button", class: "btn btn-outline shrink-0", onclick: () => accountDialog(user) }, "Open"),
              ))),
            )
          : null,
        h("div", { class: "card grid gap-3 p-3 sm:grid-cols-2" }, h("div", { class: "space-y-1" }, h("label", { class: "field-label" }, "Search"), searchInput), searchableSelect({ label: "Status", value: ui.status, options: [{ value: "", label: "All" }, ...Object.entries(STATUS).map(([value, label]) => ({ value, label }))], onChange: (value) => { ui.status = String(value); draw(); } })),
        users.length === 0
          ? emptyState({ title: "No accounts yet", text: "Personnel sign up with their DepEd email, then appear here." })
          : dataList({
              label: "Users",
              items: shown,
              columns: [
                { label: "Name", primary: true, cell: (/** @type {any} */ user) => fullName(user) },
                { label: "Email", cell: (/** @type {any} */ user) => h("span", { class: "break-all" }, user.email) },
                { label: "Role", cell: (/** @type {any} */ user) => (user.role ? ROLE_LABELS[/** @type {keyof typeof ROLE_LABELS} */ (user.role)] : "–") },
                { label: "Grade levels", cell: (/** @type {any} */ user) => (user.grade_levels.length ? `Grade ${user.grade_levels.map((/** @type {any} */ grade) => grade.grade).join(", ")}` : "–") },
                { label: "Status", cell: (/** @type {any} */ user) => h("span", { class: `badge ${STATUS_TONE[/** @type {keyof typeof STATUS_TONE} */ (user.status)]}` }, STATUS[/** @type {keyof typeof STATUS} */ (user.status)]) },
              ],
              actions: (/** @type {any} */ user) => h("button", { type: "button", class: "btn btn-outline", "aria-label": `Open ${fullName(user)}`, onclick: () => accountDialog(user) }, icon("pencil"), user.status === "pending" ? "Review" : "Manage"),
            }),
      );
    } catch (error) {
      replace(content, h("p", { role: "alert", class: "text-danger" }, errorMessage(error)));
    }
  };

  const stop = watch(["records"], draw);
  await draw();
  return stop;
}
