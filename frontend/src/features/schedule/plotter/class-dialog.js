// @ts-check
/**
 * The one "Add / Edit class" dialog (design audit, Must fix #10): every way of placing a class
 * uses it, from the day cards, the weekly grid and the phone list. It is centered and shows all
 * fields at once (UI requirement 2), its dropdowns can be searched (UI requirement 3), it offers
 * only the periods that fit the subject and are free (UI requirement 6), and typed times are
 * 12-hour (UI requirement 5).
 *
 * The time is chosen here, while making the schedule (beneficiary review, Nov 21, 2026): pick a
 * period, or type the start and end. A typed time becomes a period of the section's bell schedule
 * (a day with none gets one), so no time slots have to be set up first.
 */
import { teacherHint } from "@/api/teacher-loading.js";
import { h, replace } from "@/lib/dom.js";
import { openDialog, confirmAction, setBusy } from "@/components/dialog.js";
import { searchableSelect } from "@/components/searchable-select.js";
import { timePicker } from "@/components/time-picker.js";
import { toast } from "@/components/toast.js";
import { icon } from "@/components/icons.js";
import { api, errorMessage } from "@/api/client.js";
import { termState } from "@/state/term.js";
import {
  assignSlot,
  changeTeacher,
  clearSlot,
  conflictDetailsOf,
  getFreePeriods,
  getTeacherChoices,
  placeActivity,
  quickAddTeacher,
  resolvePeriod,
} from "@/api/schedule.js";
import { DAY_NAMES, defaultDays, entryAt, fittingPeriods, hasSubject, isActivity, isLocked, minutesLeft, minutesText, slotTimeLabel } from "@/lib/schedule.js";
import { minutesBetween } from "@/lib/time.js";

/**
 * @typedef {import("@/lib/schedule.js").Plotter} Plotter
 * @typedef {import("@/lib/schedule.js").TimeSlot} TimeSlot
 * @typedef {import("@/lib/schedule.js").DayPattern} DayPattern
 *
 * @typedef {object} ClassTarget
 * @property {number} day  the day that was tapped
 * @property {TimeSlot} [slot]  the period that was tapped, when there is one
 * @property {number} [loadingId]  a subject already chosen (tap-to-assign, or a drop that needs more)
 * @property {unknown} [error]  a conflict from a quick placement, to explain at once
 */

const TOGGLE_ON = "border-brand bg-brand text-white";
const TOGGLE_OFF = "bg-surface text-foreground hover:bg-surface-muted";

/**
 * Opens the dialog for a period (or a day, to type a time).
 * @param {{ plotter: Plotter, termId: number, target: ClassTarget }} props
 */
export function openClassDialog({ plotter, termId, target }) {
  const sectionId = plotter.section.id;
  const tappedSlot = target.slot;
  const current = tappedSlot ? entryAt(plotter.entries, target.day, tappedSlot) : undefined;
  const isEditing = hasSubject(current);
  const isCurrentLocked = current ? isLocked(current) : false;
  const dayName = DAY_NAMES[target.day];

  /** @type {{ kind: "subject" | "activity", loadingId: number | null, teacherId: number | null, roomId: number | null, slotId: number | null, days: number[], typing: boolean, free: import("@/lib/schedule.js").FreePeriod[] | null }} */
  const state = {
    kind: isActivity(current) ? "activity" : "subject",
    loadingId: target.loadingId ?? current?.section_subject_id ?? null,
    teacherId: null,
    roomId: current?.room_id ?? plotter.section.home_room_id,
    slotId: tappedSlot?.id ?? null,
    days: isEditing ? [target.day] : [],
    // No period tapped and no bell schedule yet: start by typing the time.
    typing: !tappedSlot && plotter.patterns.length === 0,
    free: null,
  };

  const loading = () => plotter.loading.find(({ id }) => id === state.loadingId);
  /** A chosen period of an asynchronous session (Senior High) takes no room (Nov 21, 2026). */
  const isAsyncChosen = () => !state.typing && state.slotId !== null && plotter.patterns.some(({ slots }) => slots.some((slot) => slot.id === state.slotId && slot.is_async));
  const chosenTeacherId = () => state.teacherId ?? loading()?.teacher_id ?? null;

  const errorBox = h("div", { role: "alert", "aria-live": "assertive" });
  const kindArea = h("div");
  const fieldsArea = h("div", { class: "space-y-4" });
  const periodsArea = h("div", { class: "space-y-2" });
  const daysArea = h("div");
  const saveButton = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-primary", onclick: () => save() }, isEditing ? "Save changes" : "Add class"));
  const removeButton = /** @type {HTMLButtonElement} */ (h("button", { type: "button", class: "btn btn-outline text-danger", onclick: () => remove() }, icon("trash"), "Remove from selected days"));

  const title = isEditing ? `Edit class · ${dayName}` : tappedSlot ? `Add class · ${dayName}` : `Add class · ${dayName}`;
  const description = tappedSlot ? `${plotter.section.label} · ${slotTimeLabel(tappedSlot)} · ${tappedSlot.minutes} mins` : `${plotter.section.label}. Choose a period, or type the start and end time.`;

  /** @type {ReturnType<typeof setInterval> | undefined} */
  let recheck;
  const { close } = openDialog({
    title,
    description,
    onClose: () => {
      clearInterval(recheck);
      window.removeEventListener("focus", onFocus);
    },
    body: h("div", { class: "space-y-4" }, errorBox, kindArea, fieldsArea),
    footer: [
      h("button", { type: "button", class: "btn btn-outline", onclick: () => close() }, "Cancel"),
      isEditing && !isCurrentLocked ? removeButton : null,
      !isCurrentLocked ? saveButton : null,
    ],
  });

  /* ---------- What goes here: a subject or an activity ---------- */

  const drawKind = () => {
    if (isCurrentLocked) {
      replace(kindArea, h("p", { class: "rounded-lg bg-surface-muted p-3 text-sm" }, `This class is ${current?.status} and cannot be changed.`));
      return;
    }
    replace(
      kindArea,
      h(
        "div",
        { role: "group", "aria-label": "What goes here", class: "grid grid-cols-2 overflow-hidden rounded-lg border" },
        ["subject", "activity"].map((kind) =>
          h(
            "button",
            {
              type: "button",
              "aria-pressed": String(state.kind === kind),
              class: `btn rounded-none ${state.kind === kind ? TOGGLE_ON : TOGGLE_OFF}`,
              onclick: () => {
                state.kind = /** @type {"subject" | "activity"} */ (kind);
                errorBox.replaceChildren();
                drawKind();
                drawFields();
              },
            },
            kind === "subject" ? "Subject" : "Activity",
          ),
        ),
      ),
    );
  };

  /* ---------- The fields ---------- */

  const drawFields = () => {
    if (state.kind === "activity") {
      drawActivity();
      return;
    }

    const subjectSelect = searchableSelect({
      label: "Subject",
      placeholder: "Choose the subject",
      value: state.loadingId,
      disabled: isCurrentLocked,
      options: plotter.loading.map((item) => ({ value: item.id, label: item.subject, hint: `${item.teacher} · ${minutesText(item)}` })),
      onChange: (value) => {
        state.loadingId = Number(value);
        state.teacherId = null;
        drawFields();
      },
    });

    const subject = loading();
    const teacherSelect = searchableSelect({
      label: "Teacher",
      placeholder: subject ? subject.teacher : "Choose the subject first",
      value: chosenTeacherId(),
      disabled: !subject || isCurrentLocked,
      options: subject ? [{ value: subject.teacher_id, label: subject.teacher }] : [],
      help: subject ? "From the teacher loading. A new teacher here teaches all of this subject's classes in the section." : undefined,
      onChange: (value) => {
        state.teacherId = Number(value);
        refreshFree();
      },
      create: {
        label: (typed) => `Add new teacher "${typed}"`,
        run: async (typed) => {
          const parts = typed.trim().split(/\s+/);
          if (parts.length < 2) {
            toast.error("Type the first and last name of the new teacher.");
            return;
          }
          try {
            const teacher = await quickAddTeacher({ first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] });
            toast.success(`${teacher.name} was added. Complete their record later on the Teachers page.`);
            state.teacherId = teacher.id;
            teacherSelect.setOptions([...teacherOptions, { value: teacher.id, label: teacher.name }]);
            teacherSelect.setValue(teacher.id);
            refreshFree();
          } catch (error) {
            toast.error(error);
          }
        },
      },
    });

    /** @type {{ value: number, label: string, hint?: string }[]} */
    let teacherOptions = subject ? [{ value: subject.teacher_id, label: subject.teacher }] : [];
    if (subject) {
      getTeacherChoices(termId, sectionId)
        .then((teachers) => {
          teacherOptions = teachers.map((/** @type {any} */ teacher) => ({ value: teacher.id, label: teacher.name, hint: teacherHint(teacher) }));
          if (!teacherOptions.some(({ value }) => value === subject.teacher_id)) teacherOptions.unshift({ value: subject.teacher_id, label: subject.teacher });
          teacherSelect.setOptions(teacherOptions);
        })
        .catch(() => {});
    }

    const roomSelect = searchableSelect({
      label: "Room",
      placeholder: "Choose the room",
      value: state.roomId,
      disabled: isCurrentLocked,
      options: plotter.rooms.map((room) => ({ value: room.id, label: room.label })),
      help: plotter.section.home_room_id && state.roomId === plotter.section.home_room_id ? "The section's home room." : undefined,
      onChange: (value) => {
        state.roomId = Number(value);
        refreshFree();
      },
    });

    replace(
      fieldsArea,
      subjectSelect,
      plotter.loading.length === 0 ? h("p", { class: "field-help text-warning" }, "This section has no teacher loading yet. Add its subjects in Teacher Loading first.") : null,
      teacherSelect,
      roomSelect,
      periodsArea,
      daysArea,
    );

    refreshFree();
  };

  /* ---------- Where: the periods that fit (UI requirement 6), or a typed time ---------- */

  let freeRequest = 0;
  /** Settles when the free periods for the chosen subject, teacher and room are known. */
  let freeReady = Promise.resolve();
  /** @param {{ quiet?: boolean }} [options]  quiet: a background check, with no loading shimmer */
  const refreshFree = (options) => {
    freeReady = loadFree(options);
    return freeReady;
  };
  const loadFree = async ({ quiet = false } = {}) => {
    const subject = loading();
    if (!subject) {
      replace(periodsArea, h("p", { class: "field-help" }, "Choose the subject to see the periods it fits."));
      daysArea.replaceChildren();
      return;
    }
    const thisRequest = ++freeRequest;
    if (!quiet) replace(periodsArea, h("div", { class: "skeleton h-11 w-full" }));
    try {
      if (!quiet) state.free = null;
      const free = await getFreePeriods(termId, sectionId, { teacherId: chosenTeacherId(), roomId: state.roomId });
      if (thisRequest !== freeRequest) return freeReady;
      state.free = free;
      drawPeriods();
    } catch (error) {
      replace(periodsArea, h("p", { class: "field-error" }, errorMessage(error)));
    }
  };

  const fits = () => {
    const subject = loading();
    if (!subject || !state.free) return [];
    return fittingPeriods({
      patterns: plotter.patterns,
      loading: subject,
      free: state.free,
      editing: isEditing && tappedSlot && current ? { slotId: tappedSlot.id, days: plotter.entries.filter((entry) => entry.start_time === tappedSlot.start_time && entry.section_subject_id === current.section_subject_id).map(({ day }) => day), sameSubject: current.section_subject_id === state.loadingId } : undefined,
    });
  };

  /** The typed time: checked while it is chosen (the end must be after the start). */
  const typedError = h("p", { class: "field-error", role: "alert", hidden: true });
  const checkTyped = () => {
    const start = startPicker.getValue();
    const end = endPicker.getValue();
    const message = start && end && minutesBetween(start, end) <= 0 ? "The end time must be after the start time." : "";
    typedError.textContent = message;
    typedError.hidden = !message;
    return !message;
  };
  const startPicker = timePicker({ label: "Start time", onChange: () => checkTyped() });
  const endPicker = timePicker({ label: "End time", onChange: () => checkTyped() });

  const drawTyping = () => {
    replace(
      periodsArea,
      h("p", { class: "field-label" }, "Time"),
      h("div", { class: "flex flex-wrap gap-4" }, startPicker, endPicker),
      typedError,
      h("p", { class: "field-help" }, "A new time becomes a period of the bell schedule, so the conflict rules and the Class Program still work. It must not overlap a period or a break."),
      plotter.patterns.length > 0 ? h("button", { type: "button", class: "btn btn-quiet px-0 text-brand", onclick: () => { state.typing = false; drawPeriods(); } }, icon("arrow-left"), "Choose a period instead") : null,
    );
    drawDays(null);
  };

  const drawPeriods = () => {
    if (state.typing) {
      drawTyping();
      return;
    }
    const subject = /** @type {import("@/lib/schedule.js").Loading} */ (loading());
    const options = fits();
    const shownDay = (/** @type {{ freeDays: number[] }} */ fit) => fit.freeDays.includes(target.day);
    // The tapped day's periods first, the others after.
    options.sort((a, b) => Number(shownDay(b)) - Number(shownDay(a)) || a.slot.start_time.localeCompare(b.slot.start_time));

    if (state.slotId !== null && !options.some(({ slot }) => slot.id === state.slotId)) {
      state.slotId = options.find(shownDay)?.slot.id ?? null;
    }

    const left = minutesLeft(subject);
    // The period that was tapped but cannot be offered: say why, in plain words.
    const tappedBusy = tappedSlot && !options.some(({ slot }) => slot.id === tappedSlot.id)
      ? (state.free?.find(({ slot_id: slotId }) => slotId === tappedSlot.id)?.busy ?? []).filter(({ day }) => day === target.day)
      : [];
    const tooLong = tappedSlot && !tappedSlot.is_break && tappedSlot.minutes > left && tappedBusy.length === 0 && !options.some(({ slot }) => slot.id === tappedSlot.id);
    const header = h(
      "div",
      { class: "space-y-2" },
      h(
        "div",
        { class: "flex flex-wrap items-baseline justify-between gap-2" },
        h("p", { class: "field-label" }, "Period"),
        h("p", { class: "field-help" }, left === Infinity ? `${subject.subject}: ${subject.scheduled_minutes} mins a week on the schedule so far.` : left > 0 ? `${subject.subject}: ${left} mins a week still to place.` : `${subject.subject} is complete.`),
      ),
      tappedSlot && (tappedBusy.length || tooLong)
        ? h(
            "p",
            { class: "rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" },
            `${slotTimeLabel(tappedSlot)} is not offered. `,
            tappedBusy.length ? tappedBusy.map(({ day, reason }) => `${DAY_NAMES[day]}: ${reason}`).join(" ") : `It is ${tappedSlot.minutes} mins, more than the ${left} mins left.`,
          )
        : null,
    );

    // Every period of the bell schedule as a block, so the scheduler sees why one cannot be used
    // before saving: Available (choose it), Selected, or Full / Too long (disabled, with the reason).
    const blocks = [
      ...options.map((fit) => ({ ...fit, reason: null })),
      ...plotter.patterns.flatMap((pattern) => pattern.slots.filter((slot) => !slot.is_break && !options.some((fit) => fit.slot.id === slot.id)).map((slot) => {
        const period = state.free?.find(({ slot_id: slotId }) => slotId === slot.id);
        const busy = period && period.free_days.length === 0 ? period.busy[0]?.reason : null;
        return { slot, pattern, freeDays: /** @type {number[]} */ ([]), reason: busy ? { badge: "Full", text: busy } : { badge: "Too long", text: `It is ${slot.minutes} mins; ${left} mins are left for ${subject.subject}.` } };
      }).sort((a, b) => a.slot.start_time.localeCompare(b.slot.start_time))),
    ];

    replace(
      periodsArea,
      header,
      left <= 0
          ? h("p", { class: "rounded-lg bg-surface-muted p-3 text-sm" }, "This subject already has all its minutes. Choose another subject, or remove one of its classes first.")
          : [
              options.length === 0 ? h("p", { role: "status", class: "rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" }, "No period is free for this subject now: each one below says why. Try another room or teacher, or free a period first.") : null,
              h(
                "div",
                { role: "radiogroup", "aria-label": "Period", class: "grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2" },
                blocks.map(({ slot, pattern, freeDays, reason }) => {
                  const isChosen = !reason && state.slotId === slot.id;
                  return h(
                    "button",
                    {
                      type: "button",
                      role: "radio",
                      "aria-checked": String(isChosen),
                      "aria-disabled": reason ? "true" : null,
                      title: reason?.text,
                      class: `min-h-11 rounded-lg border px-3 py-2 text-left text-sm ${reason ? "cursor-not-allowed border-dashed bg-surface-muted text-muted-foreground" : isChosen ? "border-brand bg-brand-soft ring-1 ring-brand" : "hover:border-brand hover:bg-surface-muted"}`,
                      onclick: () => {
                        if (reason) {
                          showError(`${slotTimeLabel(slot)} cannot be used: ${reason.text}`);
                          return;
                        }
                        state.slotId = slot.id;
                        drawPeriods();
                      },
                    },
                    h("span", { class: "flex items-center justify-between gap-2" }, h("span", { class: "font-medium" }, slotTimeLabel(slot), slot.is_async ? h("span", { class: "badge ml-1 bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100" }, "Async") : null), reason ? h("span", { class: "badge shrink-0 bg-surface text-muted-foreground" }, reason.badge) : isChosen ? h("span", { class: "badge shrink-0 bg-brand text-white" }, "Selected") : h("span", { class: "badge shrink-0 bg-success/10 text-success" }, "Available")),
                    h("span", { class: "block text-small" }, reason ? reason.text : `${slot.minutes} mins · ${plotter.patterns.length > 1 ? `${pattern.name} · ` : ""}free ${freeDays.map((day) => DAY_NAMES[day].slice(0, 3)).join(", ")}`),
                  );
                }),
              ),
            ],
      left > 0 ? h("button", { type: "button", class: "btn btn-quiet px-0 text-brand", onclick: () => { state.typing = true; drawPeriods(); } }, icon("clock"), "Type another time") : null,
    );

    const chosen = options.find(({ slot }) => slot.id === state.slotId) ?? null;
    if (chosen?.slot.is_async) periodsArea.append(h("p", { class: "rounded-lg bg-sky-50 p-2 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100" }, "Asynchronous session: this class needs no room, so the room above is not used."));
    drawDays(chosen);
  };

  /**
   * The days of the chosen period. Busy days cannot be picked and say why.
   * @param {null | { slot: TimeSlot, pattern: DayPattern, freeDays: number[], busy: { day: number, reason: string }[] }} chosen
   */
  const drawDays = (chosen) => {
    const allDays = chosen ? chosen.pattern.days : [1, 2, 3, 4, 5];
    const usable = chosen ? chosen.freeDays : allDays;
    if (state.days.length === 0 || state.days.some((day) => !usable.includes(day))) {
      state.days = chosen ? defaultDays(plotter, chosen.pattern, chosen.slot, target.day, chosen.freeDays) : [target.day];
      if (state.days.length === 0 && usable.length > 0) state.days = [usable[0]];
    }

    const subject = loading();
    const minutes = chosen ? chosen.slot.minutes : 0;
    const total = minutes * state.days.length;
    const left = subject ? minutesLeft(subject) : 0;

    replace(
      daysArea,
      h(
        "fieldset",
        { class: "space-y-2" },
        h("legend", { class: "field-label" }, "Days"),
        h(
          "div",
          { class: "flex flex-wrap gap-2" },
          allDays.map((day) => {
            const isUsable = usable.includes(day);
            const isOn = state.days.includes(day);
            return h(
              "button",
              {
                type: "button",
                "aria-pressed": String(isOn),
                disabled: !isUsable || isCurrentLocked,
                class: `btn min-w-16 border ${isOn ? TOGGLE_ON : TOGGLE_OFF}`,
                onclick: () => {
                  state.days = isOn ? state.days.filter((item) => item !== day) : [...state.days, day].sort();
                  drawDays(chosen);
                },
              },
              DAY_NAMES[day].slice(0, 3),
            );
          }),
        ),
        chosen && chosen.busy.length > 0 ? h("ul", { class: "space-y-1" }, chosen.busy.map(({ day, reason }) => h("li", { class: "text-small text-muted-foreground" }, `${DAY_NAMES[day]}: ${reason}`))) : null,
        chosen && subject && total > left && !isEditing ? h("p", { class: "field-help text-warning" }, `This adds ${total} mins, ${total - left} more than ${subject.subject} still needs. It will be saved and flagged.`) : null,
      ),
    );
  };

  /* ---------- Activities: Flag Ceremony, Catch-up Friday... ---------- */

  const drawActivity = () => {
    if (!tappedSlot) {
      replace(fieldsArea, h("p", { class: "rounded-lg bg-surface-muted p-3 text-sm" }, "Activities go on a period of the bell schedule. Tap a period to add one."));
      return;
    }
    const pattern = plotter.patterns.find(({ slots }) => slots.some(({ id }) => id === tappedSlot.id));
    /** @type {{ activityId: number | null, scope: "section" | "grade" | "all", days: number[] }} */
    const activity = { activityId: current?.activity_id ?? null, scope: "section", days: [target.day] };
    const review = h("div");

    const draw = () => {
      replace(
        fieldsArea,
        searchableSelect({
          label: "Activity",
          placeholder: "Choose or type the activity",
          value: activity.activityId,
          help: "Like Flag Ceremony or Catch-up Friday. Type a new one to add it.",
          options: plotter.activities.map((item) => ({ value: item.id, label: item.name })),
          onChange: (value) => {
            activity.activityId = Number(value);
            review.replaceChildren();
          },
          // Activities are added right here, while plotting (team decision, Nov 21, 2026).
          create: {
            label: (typed) => `Add "${typed}"`,
            run: async (typed) => {
              try {
                const { data } = /** @type {{ data: { id: number } }} */ (await api(`/school-years/${termState.term?.school_year.id}/activities`, { method: "POST", body: { name: typed, code: null } }));
                plotter.activities.push({ id: data.id, name: typed });
                activity.activityId = data.id;
                toast.success(`${typed} was added.`);
                draw();
              } catch (error) {
                showError(errorMessage(error));
              }
            },
          },
        }),
        h(
          "fieldset",
          { class: "space-y-2" },
          h("legend", { class: "field-label" }, "Apply to"),
          h(
            "div",
            { class: "grid gap-2" },
            /** @type {const} */ ([
              ["section", "This section only"],
              ["grade", `All Grade ${plotter.section.grade} sections (${plotter.apply_counts.grade})`],
              ["all", `All my sections (${plotter.apply_counts.all})`],
            ]).map(([value, label]) =>
              h("button", { type: "button", "aria-pressed": String(activity.scope === value), class: `btn justify-start border ${activity.scope === value ? TOGGLE_ON : TOGGLE_OFF}`, onclick: () => { activity.scope = value; review.replaceChildren(); draw(); } }, label),
            ),
          ),
        ),
        h(
          "fieldset",
          { class: "space-y-2" },
          h("legend", { class: "field-label" }, "Days"),
          h(
            "div",
            { class: "flex flex-wrap gap-2" },
            (pattern?.days ?? [target.day]).map((day) =>
              h("button", { type: "button", "aria-pressed": String(activity.days.includes(day)), class: `btn min-w-16 border ${activity.days.includes(day) ? TOGGLE_ON : TOGGLE_OFF}`, onclick: () => { activity.days = activity.days.includes(day) ? activity.days.filter((item) => item !== day) : [...activity.days, day].sort(); review.replaceChildren(); draw(); } }, DAY_NAMES[day].slice(0, 3)),
            ),
          ),
        ),
        review,
      );
    };

    activityState = activity;
    activityReview = review;
    draw();
  };

  /** @type {null | { activityId: number | null, scope: "section" | "grade" | "all", days: number[] }} */
  let activityState = null;
  /** @type {HTMLElement | null} */
  let activityReview = null;
  /** @type {any} */
  let reviewed = null;

  const saveActivity = async () => {
    if (!tappedSlot || !activityState || !activityState.activityId || activityState.days.length === 0) {
      showError("Choose an activity and at least one day.");
      return;
    }
    const input = { slotId: tappedSlot.id, activity_id: activityState.activityId, scope: activityState.scope, days: activityState.days };

    // A review comes first: which sections get it, and which classes it replaces.
    if (!reviewed || JSON.stringify(reviewed.input) !== JSON.stringify(input)) {
      const summary = await placeActivity(termId, sectionId, { ...input, preview: true });
      reviewed = { input, summary };
      const unplaced = summary.sections.flatMap((/** @type {any} */ section) => section.unplaced.map((/** @type {string} */ item) => `${section.label}: ${item}`));
      const skipped = summary.sections.filter((/** @type {any} */ section) => section.skipped);
      replace(
        /** @type {HTMLElement} */ (activityReview),
        h(
          "div",
          { class: "space-y-2 rounded-lg border p-3 text-sm" },
          h("p", { class: "font-medium" }, `${summary.activity} goes on ${summary.placed_sections} ${summary.placed_sections === 1 ? "section" : "sections"} at ${summary.time}.`),
          unplaced.length ? h("div", null, h("p", null, "These classes will be taken off and listed as not placed:"), h("ul", { class: "list-disc pl-5" }, unplaced.map((item) => h("li", null, item)))) : null,
          skipped.length ? h("div", null, h("p", null, "Left out:"), h("ul", { class: "list-disc pl-5" }, skipped.map((/** @type {any} */ section) => h("li", null, `${section.label}: ${section.skipped}`)))) : null,
          h("p", { class: "text-muted-foreground" }, "Press Save again to place it."),
        ),
      );
      return;
    }

    const summary = await placeActivity(termId, sectionId, { ...input, preview: false });
    toast.success(`${summary.activity} was placed on ${summary.placed_sections} ${summary.placed_sections === 1 ? "section" : "sections"}.`);
    close();
  };

  /* ---------- Save and remove ---------- */

  /** @param {string} message */
  const showError = (message) => {
    replace(errorBox, h("p", { class: "rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger" }, message));
  };

  /** Explains a conflict in plain words, with buttons for the free rooms and teachers. */
  const showConflict = (/** @type {unknown} */ error) => {
    const details = conflictDetailsOf(error);
    if (!details) {
      showError(errorMessage(error));
      return;
    }
    const subject = loading();
    replace(
      errorBox,
      h(
        "div",
        { class: "space-y-2 rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm" },
        h("p", { class: "font-medium text-danger" }, "Not saved. This clashes with:"),
        h("ul", { class: "list-disc space-y-1 pl-5 text-danger" }, details.conflicts.map(({ message }) => h("li", null, message))),
        details.suggestions.teachers.length && subject
          ? h(
              "div",
              { class: "space-y-1" },
              h("p", { class: "field-help" }, "Teachers free at this time:"),
              h("div", { class: "flex flex-wrap gap-2" }, details.suggestions.teachers.map((teacher) =>
                h("button", { type: "button", class: "btn btn-outline h-auto flex-col items-start py-1", onclick: () => { state.teacherId = teacher.id; errorBox.replaceChildren(); drawFields(); } }, h("span", null, teacher.name), h("span", { class: "text-small font-normal text-muted-foreground" }, `${teacher.teaches_subject ? `Teaches ${subject.subject} · ` : ""}${teacher.hours_per_week} hrs a week`)),
              )),
            )
          : null,
        details.suggestions.rooms.length
          ? h(
              "div",
              { class: "space-y-1" },
              h("p", { class: "field-help" }, "Rooms free at this time:"),
              h("div", { class: "flex flex-wrap gap-2" }, details.suggestions.rooms.map((room) => h("button", { type: "button", class: "btn btn-outline", onclick: () => { state.roomId = room.id; errorBox.replaceChildren(); drawFields(); } }, room.label))),
            )
          : null,
        details.suggestions.slots.length ? h("p", { class: "field-help" }, `Free periods for this teacher and room: ${details.suggestions.slots.map(({ label }) => label).join(", ")}.`) : null,
      ),
    );
  };

  const save = async () => {
    errorBox.replaceChildren();
    setBusy(saveButton, true, "Checking...");
    try {
      // A quick tap can come before the free periods are known: wait for them first.
      await freeReady;
      setBusy(saveButton, false);
      setBusy(saveButton, true);
      if (state.kind === "activity") {
        await saveActivity();
        return;
      }

      const subject = loading();
      if (!subject || (!state.roomId && !isAsyncChosen())) {
        showError("Choose the subject and the room.");
        return;
      }

      // The period of each chosen day: a period from the list, or a typed time.
      /** @type {Map<number, number[]>} slot id => days */
      const placements = new Map();
      if (state.typing) {
        const start = startPicker.getValue();
        const end = endPicker.getValue();
        if (!start || !end) {
          showError("Choose the start and end time.");
          return;
        }
        if (!checkTyped()) {
          showError("The end time must be after the start time.");
          return;
        }
        if (state.days.length === 0) {
          showError("Choose at least one day.");
          return;
        }
        const slots = await resolvePeriod(termId, sectionId, { days: state.days, start_time: start, end_time: end });
        for (const day of state.days) {
          const slotId = slots[String(day)];
          placements.set(slotId, [...(placements.get(slotId) ?? []), day]);
        }
      } else {
        if (!state.slotId || state.days.length === 0) {
          showError("Choose a period and at least one day.");
          return;
        }
        placements.set(state.slotId, state.days);
      }

      if (chosenTeacherId() && chosenTeacherId() !== subject.teacher_id) {
        await changeTeacher(termId, sectionId, { subjectId: subject.subject_id, teacherId: /** @type {number} */ (chosenTeacherId()) });
      }

      for (const [slotId, days] of placements) {
        await assignSlot(termId, sectionId, { slotId, section_subject_id: subject.id, room_id: isAsyncChosen() ? null : state.roomId, days });
      }

      // Moved to another period: take the class off its old one.
      if (isEditing && tappedSlot && !placements.has(tappedSlot.id)) {
        await clearSlot(termId, sectionId, { slotId: tappedSlot.id, days: [target.day] });
      }

      toast.success(`${subject.subject} ${isEditing ? "was changed" : "was added"}.`);
      close();
    } catch (error) {
      showConflict(error);
      toast.error(error);
      // The blocks may have changed (another user took one): check them again, so the list is current.
      if (conflictDetailsOf(error)) refreshFree();
    } finally {
      if (saveButton.isConnected) setBusy(saveButton, false);
    }
  };

  // While the dialog is open, another scheduler may take a block: check again every 30 seconds and
  // when the window comes back into focus, so a taken block turns Full before anyone saves.
  function onFocus() {
    if (loading()) refreshFree({ quiet: true });
  }
  recheck = setInterval(() => {
    if (loading()) refreshFree({ quiet: true });
  }, 30_000);
  window.addEventListener("focus", onFocus);

  const remove = async () => {
    if (!tappedSlot || !current) return;
    // The days chosen under Days (the tapped day at first), like before.
    const days = state.days.length > 0 ? state.days : [target.day];
    const isSure = await confirmAction({
      title: `Remove ${current.subject ?? "this class"}?`,
      message: `This takes it off ${days.map((day) => DAY_NAMES[day]).join(", ")} at ${slotTimeLabel(tappedSlot)}. The teacher loading stays.`,
      confirmLabel: "Yes, remove it",
    });
    if (!isSure) return;
    setBusy(removeButton, true, "Removing...");
    try {
      await clearSlot(termId, sectionId, { slotId: tappedSlot.id, days });
      toast.success(`${current.subject ?? "The class"} was removed.`);
      close();
    } catch (error) {
      showError(errorMessage(error));
      toast.error(error);
    } finally {
      if (removeButton.isConnected) setBusy(removeButton, false);
    }
  };

  drawKind();
  drawFields();
  if (target.error) showConflict(target.error);
}
