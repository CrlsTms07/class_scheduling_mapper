// @ts-check
/**
 * My Schedule (approved classes only, PDF and CSV) and My Profile, for teachers and for a
 * Chairperson or Master Teacher with a personnel record.
 */
import { SHIFT_LABELS } from "@/lib/shifts.js";
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { downloadButtons } from "@/components/download-buttons.js";
import { skeletonPage } from "@/components/loading.js";
import { emptyState, pageHeader } from "@/components/page-header.js";
import { weekFromReportGrid, weekTable } from "@/components/week-table.js";
import { errorMessage } from "@/api/client.js";
import { getMyProfile, getMySchedule } from "@/api/dashboard.js";
import { termState } from "@/state/term.js";

const NO_RECORD = "Your account is not linked to a teacher record yet. Ask the Admin to link it on the Users page.";

/** @type {import("@/router.js").RenderPage} */
export async function renderMySchedule(container) {
  const term = termState.term;
  if (!term) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "The Admin has not started a school year yet." })));
    return;
  }
  replace(container, skeletonPage());
  try {
    const schedule = await getMySchedule(term.id);
    replace(
      container,
      h(
        "div",
        { class: "space-y-5 p-4 sm:p-6" },
        pageHeader({ icon: "calendar-check", title: "My Schedule", description: `Your approved classes in ${term.name}, SY ${term.school_year.name}.`, actions: schedule ? downloadButtons({ basePath: `/terms/${term.id}/my-schedule/program`, label: "My Schedule" }) : null }),
        !schedule
          ? h("p", { class: "rounded-lg bg-surface-muted p-3 text-sm" }, NO_RECORD)
          : [
              schedule.details?.length ? h("p", { class: "text-sm text-muted-foreground" }, schedule.details.join(" · ")) : null,
              schedule.not_final_count ? h("p", { class: "rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" }, `${schedule.not_final_count} of your classes are still being prepared. They show here once the Admin approves them.`) : null,
              schedule.rows.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "You have no approved classes yet.") : weekTable(weekFromReportGrid(schedule)),
              h("p", { class: "text-sm" }, "Total per week: ", h("strong", null, `${schedule.totals.week} minutes`), schedule.totals.week_duration && schedule.totals.week_duration !== `${schedule.totals.week} minutes` ? ` (${schedule.totals.week_duration})` : ""),
            ],
      ),
    );
  } catch (error) {
    replace(container, h("p", { role: "alert", class: "p-6 text-danger" }, errorMessage(error)));
  }
}

/** @type {import("@/router.js").RenderPage} */
export async function renderMyProfile(container) {
  const term = termState.term;
  if (!term) {
    container.append(h("div", { class: "p-4 sm:p-6" }, emptyState({ title: "No school year yet", text: "The Admin has not started a school year yet." })));
    return;
  }
  replace(container, skeletonPage());
  try {
    const profile = await getMyProfile(term.id);
    const shifts = SHIFT_LABELS;
    const row = (/** @type {string} */ label, /** @type {string | null | undefined} */ value) => [h("dt", { class: "text-sm text-muted-foreground" }, label), h("dd", { class: "text-sm font-medium sm:col-span-2" }, value || "–")];
    replace(
      container,
      h(
        "div",
        { class: "space-y-5 p-4 sm:p-6" },
        pageHeader({ icon: "user", title: "My Profile", description: "Your teacher record. The Admin or your Chairperson keeps it up to date." }),
        !profile
          ? h("p", { class: "rounded-lg bg-surface-muted p-3 text-sm" }, NO_RECORD)
          : [
              h("dl", { class: "card grid gap-x-4 gap-y-3 p-4 sm:grid-cols-3" },
                row("Name", profile.printed_name), row("Email", profile.email), row("Department", profile.department), row("Designation", profile.designation),
                row("Shift", shifts[/** @type {keyof typeof shifts} */ (profile.shift)]), row("Subjects", `${profile.assigned} of ${profile.max_subjects} this ${term.school_year.term_label.toLowerCase()}`), row("Advisory", profile.advisory),
                row("Tasks", profile.tasks.join(", ")),
              ),
              h("a", { href: "/my-schedule", class: "btn btn-outline" }, icon("calendar-check"), "Open My Schedule"),
            ],
      ),
    );
  } catch (error) {
    replace(container, h("p", { role: "alert", class: "p-6 text-danger" }, errorMessage(error)));
  }
}
