// @ts-check
/**
 * The dashboard: what each role needs first.
 * - Admin: what waits for them, the school's setup, and how far each grade is.
 * - Chairperson and Master Teacher: their next steps and the six setup steps in order.
 * - Teacher: the next class, today's classes and the week's teaching time.
 * The setup steps show on phones too (design audit, Must fix #8).
 */
import { h, replace } from "@/lib/dom.js";
import { icon } from "@/components/icons.js";
import { skeletonPage } from "@/components/loading.js";
import { emptyState } from "@/components/page-header.js";
import { errorMessage } from "@/api/client.js";
import { classesOn, getAdminDashboard, getMyProfile, getMySchedule, getSchedulerDashboard, nextClass } from "@/api/dashboard.js";
import { session } from "@/state/session.js";
import { termState } from "@/state/term.js";
import { roleWithScope } from "@/lib/navigation.js";
import { DAY_NAMES } from "@/lib/schedule.js";
import { formatTime } from "@/lib/time.js";

/** @param {number} count @param {string} word @param {string} [many] */
const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

/**
 * A number tile that leads to where it is dealt with.
 * @param {{ label: string, value: string | number, note: string, to?: string, tone?: string }} props
 */
function tile({ label, value, note, to, tone = "text-accent" }) {
  const body = [h("p", { class: "text-small text-muted-foreground" }, label), h("p", { class: `text-2xl font-bold ${tone}` }, String(value)), h("p", { class: "text-small text-muted-foreground" }, note)];
  return to ? h("a", { href: to, class: "card block p-4 hover:border-brand" }, body) : h("div", { class: "card p-4" }, body);
}

/** What each setup step is, where it is done, and how far along it is. */
function describeStep(/** @type {any} */ step) {
  const counts = step.counts;
  switch (step.key) {
    case "rooms": return { title: "Rooms & Buildings", detail: "The buildings and rooms classes are held in.", to: "/buildings", status: `${plural(counts.buildings, "building")} · ${plural(counts.rooms, "room")} in use` };
    case "bell": return { title: "Bell schedule", detail: "The periods and breaks of your department, like Monday – Thursday and Friday.", to: "/time-slots", status: counts.ready === counts.departments && counts.departments > 0 ? plural(counts.patterns, "bell schedule") : "Not set up yet" };
    case "subjects": return { title: "Subjects & Sections", detail: "Subjects and activities of your grade levels, and your sections.", to: "/subjects", status: `${plural(counts.subjects, "subject")} · ${plural(counts.activities, "activity", "activities")} · ${plural(counts.sections, "section")}` };
    case "teachers": return { title: "Teachers", detail: "Teaching personnel, with their shift and how much they may carry.", to: "/teachers", status: plural(counts.teachers, "teacher") };
    case "loading": return { title: "Teacher Loading", detail: "Who teaches each subject of each section, and each teacher's hours a week.", to: "/teacher-loading", status: `${counts.loaded} of ${counts.needed} subjects have a teacher${counts.over_hours ? ` · ${counts.over_hours} overloaded` : ""}` };
    default: return { title: "Plot", detail: "Place each section's subjects and activities on its weekly schedule, then submit.", to: "/schedule", status: `${counts.started} of ${counts.sections} started · ${counts.submitted} submitted` };
  }
}

/** The six steps of making a schedule, in order; the next one stands out. */
function stepsList(/** @type {any[]} */ steps) {
  const nextIndex = steps.findIndex(({ done }) => !done);
  return h(
    "section",
    { "aria-label": "Making the schedule", class: "space-y-2" },
    h("h2", { class: "font-semibold text-accent" }, "Making the schedule"),
    h("ol", { class: "space-y-2" }, steps.map((step, index) => {
      const { title, detail, to, status } = describeStep(step);
      const isNext = index === nextIndex;
      return h("li", null, h(
        "a",
        { href: to, class: `card flex items-start gap-3 p-3 hover:border-brand ${isNext ? "border-2 border-brand" : ""}` },
        h("span", { class: `flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step.done ? "bg-success text-white" : isNext ? "bg-brand text-white" : "bg-surface-muted"}` }, step.done ? icon("check") : String(index + 1)),
        h("span", { class: "min-w-0" }, h("span", { class: "block font-medium" }, `${index + 1}. ${title}`), h("span", { class: "block text-small text-muted-foreground" }, detail), h("span", { class: `block text-small font-medium ${step.done ? "text-success" : isNext ? "text-brand" : "text-muted-foreground"}` }, isNext ? `Next: ${status}` : status)),
      ));
    })),
  );
}

/** Each grade's sections by status: a table on wide screens, cards on phones. */
function progressList(/** @type {any[]} */ progress) {
  if (progress.length === 0) return null;
  const columns = [["not_started", "Not started"], ["draft", "Draft"], ["pending", "Pending approval"], ["approved", "Approved"], ["rejected", "Rejected"]];
  return h(
    "section",
    { "aria-label": "Schedules by grade level", class: "space-y-2" },
    h("h2", { class: "font-semibold text-accent" }, "Schedules by grade level"),
    h("div", { class: "hidden overflow-x-auto rounded-xl border md:block" }, h("table", { class: "w-full text-sm" },
      h("thead", { class: "bg-surface-muted text-left text-small text-muted-foreground" }, h("tr", null, h("th", { scope: "col", class: "p-3 font-medium" }, "Grade"), h("th", { scope: "col", class: "p-3 font-medium" }, "Sections"), columns.map(([, label]) => h("th", { scope: "col", class: "p-3 font-medium" }, label)))),
      h("tbody", null, progress.map((row) => h("tr", { class: "border-t" }, h("th", { scope: "row", class: "p-3 text-left font-medium text-accent" }, `Grade ${row.grade} (${row.level})`), h("td", { class: "p-3" }, String(row.sections)), columns.map(([key]) => h("td", { class: "p-3" }, String(row[key])))))),
    )),
    h("div", { class: "grid gap-2 md:hidden" }, progress.map((row) => h("div", { class: "card space-y-1 p-3" }, h("p", { class: "font-medium text-accent" }, `Grade ${row.grade} (${row.level}), ${plural(row.sections, "section")}`), h("dl", { class: "grid grid-cols-2 gap-x-3 text-sm" }, columns.flatMap(([key, label]) => [h("dt", { class: "text-muted-foreground" }, label), h("dd", { class: "text-right font-medium" }, String(row[key]))]))))),
  );
}

function overloaded(/** @type {any[]} */ teachers) {
  return h(
    "section",
    { "aria-label": "Overloaded teachers", class: "space-y-2" },
    h("h2", { class: "font-semibold text-accent" }, "Overloaded teachers"),
    teachers.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, "No teacher is over their limit.") : h("ul", { class: "card divide-y" }, teachers.map((teacher) => h("li", { class: "flex items-center justify-between gap-2 p-3 text-sm" }, h("span", null, teacher.name), h("a", { href: "/teacher-loading?view=teachers", class: "btn btn-quiet text-brand" }, `${teacher.assigned} of ${teacher.limit}`, icon("arrow-right"))))),
  );
}

/** @type {import("@/router.js").RenderPage} */
export async function render(container) {
  const user = session.user;
  const term = termState.term;
  const role = user?.role ?? "teacher";
  const greeting = h("div", null, h("h1", { class: "text-xl font-semibold text-brand" }, `Welcome, ${user?.first_name ?? ""}`), h("p", { class: "text-sm text-muted-foreground" }, `${roleWithScope(user).full}${term ? ` · ${term.name}, SY ${term.school_year.name}` : ""}`));

  if (!term) {
    replace(container, h("div", { class: "space-y-5 p-4 sm:p-6" }, greeting, emptyState({ title: "No school year yet", text: role === "super_admin" ? "Start the school year first: its terms, then the rest of the setup." : "The Admin has not started a school year yet.", action: role === "super_admin" ? h("a", { href: "/school-years", class: "btn btn-primary" }, icon("calendar"), "Start a school year") : null })));
    return;
  }

  replace(container, skeletonPage());
  try {
    if (role === "super_admin") {
      const [admin, steps] = await Promise.all([getAdminDashboard(term.id), getSchedulerDashboard(term.id)]);
      const doneCount = admin.checklist.filter((/** @type {any} */ item) => item.done).length;
      const links = { calendar: "/school-years", school_profile: "/report-settings", time_slots: "/time-slots", sections: "/sections", signatories: "/report-settings", schedulers: "/users" };
      replace(
        container,
        h(
          "div",
          { class: "space-y-6 p-4 sm:p-6" },
          greeting,
          h("div", { class: "grid grid-cols-2 gap-3 xl:grid-cols-4" },
            tile({ label: "Active term", value: termState.terms.find(({ is_active: isActive }) => isActive)?.name ?? "None", note: `School Year ${term.school_year.name}`, to: "/school-years" }),
            tile({ label: "Waiting for approval", value: admin.pending_sections, note: plural(admin.pending_sections, "section"), to: "/approvals", tone: admin.pending_sections ? "text-brand" : "text-accent" }),
            tile({ label: "Flags to check", value: admin.flags.total, note: admin.flags.total ? `${admin.flags.urgent} urgent, in ${plural(admin.flags.sections, "section")}` : "Nothing to check", to: "/reports?tab=validation" }),
            tile({ label: "Accounts to activate", value: admin.pending_accounts, note: "sign-ups waiting", to: "/users", tone: admin.pending_accounts ? "text-brand" : "text-accent" }),
          ),
          h(
            "details",
            { class: "card", open: doneCount < admin.checklist.length },
            h("summary", { class: "flex min-h-11 cursor-pointer items-center gap-2 p-3 font-medium" }, h("span", { class: "text-accent" }, "School setup"), h("span", { class: "text-sm text-muted-foreground" }, `${doneCount} of ${admin.checklist.length} done`)),
            h("ul", { class: "divide-y border-t" }, admin.checklist.map((/** @type {any} */ item) => h("li", null, h("a", { href: links[/** @type {keyof typeof links} */ (item.key)] ?? "/dashboard", class: "flex items-start gap-3 p-3 hover:bg-surface-muted" }, h("span", { class: `mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${item.done ? "bg-success text-white" : "bg-surface-muted"}` }, item.done ? icon("check", "size-3.5") : ""), h("span", null, h("span", { class: "block text-sm font-medium" }, item.title), h("span", { class: "block text-small text-muted-foreground" }, item.detail)))))),
            h("div", { class: "border-t p-3" }, h("a", { href: "/setup", class: "btn btn-outline w-full sm:w-auto" }, icon("clipboard"), "Open the Setup Guide (step by step, with imports)")),
          ),
          h("div", { class: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" }, stepsList(steps.steps), overloaded(admin.overloaded_teachers)),
          progressList(admin.progress),
        ),
      );
      return;
    }

    if (role === "glc" || role === "master_teacher") {
      const data = await getSchedulerDashboard(term.id);
      const nextWords = {
        revise: ["Revise what the Admin rejected", "Read the remarks, fix the schedule, then submit it again."],
        no_bell_schedule: ["Set up the bell schedule", "Add the periods and breaks of your department in Time Slots. Nothing can be plotted until then."],
        add_loading: ["Add teacher loading", "Choose who teaches each subject of these sections."],
        plot: ["Start plotting", "The loading is ready, so subjects can now be placed on the schedule."],
        submit: ["Finish and submit", "Fill the remaining slots, check the flags, then submit for approval."],
      };
      replace(
        container,
        h(
          "div",
          { class: "space-y-6 p-4 sm:p-6" },
          greeting,
          !data.has_scope ? h("p", { role: "alert", class: "rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" }, "No grade level is assigned to your account yet. Ask the Admin to give you your grade levels on the Users page.") : null,
          h("div", { class: "grid grid-cols-2 gap-3 xl:grid-cols-4" },
            tile({ label: "Sections", value: data.sections, note: "in your grade levels", to: "/schedule" }),
            tile({ label: "Waiting for approval", value: data.pending_sections, note: plural(data.pending_sections, "section"), to: "/schedule" }),
            tile({ label: "Approved", value: data.approved_sections, note: `of ${plural(data.sections, "section")}`, to: "/schedule" }),
            tile({ label: "Flags to check", value: data.flags.total, note: data.flags.total ? `${data.flags.urgent} urgent` : "Nothing to check", to: "/reports?tab=validation" }),
          ),
          data.next_steps.length
            ? h("section", { "aria-label": "Next steps", class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, "Next steps"), h("ul", { class: "grid gap-3 lg:grid-cols-2" }, data.next_steps.map((/** @type {any} */ step) => {
                const [title, detail] = nextWords[/** @type {keyof typeof nextWords} */ (step.key)] ?? [step.key, ""];
                return h("li", { class: "card space-y-2 p-4" }, h("p", { class: "font-medium" }, title), h("p", { class: "text-small text-muted-foreground" }, detail), h("div", { class: "flex flex-wrap gap-2" }, step.key === "no_bell_schedule" ? h("a", { href: "/time-slots", class: "btn btn-outline" }, "Open Time Slots") : step.sections.slice(0, 6).map((/** @type {any} */ section) => h("a", { href: step.key === "add_loading" ? `/teacher-loading?section=${section.id}` : `/schedule/sections/${section.id}`, class: "btn btn-outline" }, section.label))));
              })))
            : null,
          h("div", { class: "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" }, stepsList(data.steps), overloaded(data.overloaded_teachers)),
          progressList(data.progress),
        ),
      );
      return;
    }

    // Teacher
    const [schedule, profile] = await Promise.all([getMySchedule(term.id), getMyProfile(term.id)]);
    const date = new Date();
    const today = date.getDay();
    const now = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const isSchoolDay = today >= 1 && today <= 5;
    const classes = schedule && isSchoolDay ? classesOn(schedule, today) : [];
    const next = nextClass(classes, now);
    replace(
      container,
      h(
        "div",
        { class: "space-y-6 p-4 sm:p-6" },
        greeting,
        !schedule ? h("p", { class: "rounded-lg bg-surface-muted p-3 text-sm" }, "Your account is not linked to a teacher record yet. Ask the Admin to link it on the Users page.") : null,
        schedule?.not_final_count ? h("p", { class: "rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" }, `${schedule.not_final_count} of your classes are still being prepared. They show here once the Admin approves them.`) : null,
        h("div", { class: "grid grid-cols-2 gap-3 xl:grid-cols-4" },
          tile({ label: "Next class", value: next ? formatTime(next.start) : "None", note: next ? next.lines.filter(Boolean).slice(0, 2).join(" · ") : isSchoolDay ? "No more classes today" : "No classes today", to: "/my-schedule" }),
          tile({ label: "Classes today", value: classes.length, note: isSchoolDay ? DAY_NAMES[today] : "Weekend", to: "/my-schedule" }),
          tile({ label: "Teaching time a week", value: schedule ? `${schedule.totals.week} mins` : "–", note: schedule?.totals.week_duration ?? "", to: "/my-schedule" }),
          tile({ label: "Advisory", value: profile?.advisory ? "Adviser" : "None", note: profile?.advisory ?? "No advisory class this year", to: "/my-profile" }),
        ),
        h("section", { "aria-label": "Today", class: "space-y-2" }, h("h2", { class: "font-semibold text-accent" }, isSchoolDay ? `Today, ${DAY_NAMES[today]}` : "Today"), classes.length === 0 ? h("p", { class: "text-sm text-muted-foreground" }, isSchoolDay ? "No classes today." : "No classes on weekends.") : h("ul", { class: "card divide-y" }, classes.map((item) => h("li", { class: "flex items-start justify-between gap-3 p-3 text-sm" }, h("span", { class: "font-medium" }, `${formatTime(item.start)} – ${formatTime(item.end)}`), h("span", { class: "text-right text-muted-foreground" }, item.lines.filter(Boolean).join(" · ")))))),
        h("a", { href: "/my-schedule", class: "btn btn-primary w-full sm:w-auto" }, icon("calendar-check"), "Open My Schedule"),
      ),
    );
  } catch (error) {
    replace(container, h("div", { class: "space-y-4 p-4 sm:p-6" }, greeting, h("p", { role: "alert", class: "text-danger" }, `The dashboard could not load. ${errorMessage(error)}`)));
  }
}
