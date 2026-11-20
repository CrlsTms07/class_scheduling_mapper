// @ts-check
/**
 * "How to make a schedule": every step from the start of the school year to the printed forms,
 * with who does it and where. Same words as the current system.
 */

const ADMIN = ["super_admin"];
const SCHEDULERS = ["super_admin", "glc", "master_teacher"];

/**
 * Making a schedule from the start to the end, in the order the system expects. Each step names
 * who does it and the page where it is done.
 */
/** @type {{ title: string, intro: string, steps: { title: string, roles: string[], where?: { label: string, to: string }, what: string[], tip?: string }[] }[]} */
export const SCHEDULE_GUIDE = [
  {
    title: "Before the school year",
    intro: "Done once a year by the Admin.",
    steps: [
      {
        title: "Start the school year",
        roles: ADMIN,
        where: { label: "School Years", to: "/school-years" },
        what: [
          "Press Start New School Year, then type its name and dates.",
          "Pick the term structure: 3 Terms, 2 Semesters, 4 Quarters or Custom.",
          "Choose what to copy from last year (subjects, bell schedules, signatories), review, then confirm.",
        ],
        tip: "Only one term is active at a time. Switch it in Calendar settings when the next term starts.",
      },
      {
        title: "Activate the accounts",
        roles: ADMIN,
        where: { label: "Users", to: "/users" },
        what: [
          "Teachers on the teachers list can sign in right away after they sign up.",
          "For the others, check the teachers you know and press Activate selected as Teacher.",
          "Use Manage to make someone a Chairperson (Grades 7–10) or Master Teacher (Grades 11–12), with their grade levels.",
        ],
      },
      {
        title: "Fill in the report settings",
        roles: ADMIN,
        where: { label: "Report Settings", to: "/report-settings" },
        what: [
          "School profile, logos (top of the form or footer), region and division.",
          "Signatories of each term: Prepared by, Recommending Approval and Approved by.",
        ],
        tip: "These appear on every printed Class Program, so set them before printing.",
      },
    ],
  },
  {
    title: "Get ready",
    intro: "The Admin, or a Chairperson or Master Teacher for their own grade levels.",
    steps: [
      {
        title: "Rooms and buildings",
        roles: SCHEDULERS,
        where: { label: "Rooms & Buildings", to: "/buildings" },
        what: ["Add each building, then its rooms (number, name, capacity and who is in charge)."],
      },
      {
        title: "Bell schedule",
        roles: SCHEDULERS,
        where: { label: "Time Slots", to: "/time-slots" },
        what: [
          "Make one bell schedule for each group of days, like Monday – Thursday and Friday.",
          "Add the periods and the breaks, each with its start and end. A preset can fill the rows for you.",
        ],
        tip: "Nothing can be placed on a schedule until its department has a bell schedule.",
      },
      {
        title: "Sections",
        roles: SCHEDULERS,
        where: { label: "Sections", to: "/sections" },
        what: ["Add each section of the year with its grade, adviser, co-adviser, home room and class size."],
        tip: "Sections are encoded every year, since they change yearly.",
      },
      {
        title: "Subjects",
        roles: SCHEDULERS,
        where: { label: "Subjects", to: "/subjects" },
        what: [
          "Add the subjects of each grade with their minutes per week (for example 220 for 4 × 45 + 40).",
          "Senior High: choose the term and track of each subject.",
        ],
      },
      {
        title: "Teachers",
        roles: SCHEDULERS,
        where: { label: "Teachers", to: "/teachers" },
        what: ["Add the teaching personnel with their employee ID, department, shift and maximum hours a week."],
        tip: "Shortcut for the Admin: the Setup Guide imports whole lists of teachers, subjects, rooms and sections from an Excel template, and checks every row before saving.",
      },
      {
        title: "Teacher loading",
        roles: SCHEDULERS,
        where: { label: "Teacher Loading", to: "/teacher-loading" },
        what: [
          "By section: choose who teaches each subject of each section.",
          "By teacher (Load Distribution): check that no one carries too much. Each overload says how to fix it.",
        ],
      },
    ],
  },
  {
    title: "Make the schedule",
    intro: "The Chairperson for Junior High, the Master Teacher for Senior High. The Admin can help.",
    steps: [
      {
        title: "Open a section",
        roles: SCHEDULERS,
        where: { label: "Schedule", to: "/schedule" },
        what: ["Pick the section from its room card or from the Sections tab."],
      },
      {
        title: "Place the classes",
        roles: SCHEDULERS,
        what: [
          "Tap a subject, then tap a period (or drag it there). Choose the room if it is not the home room.",
          "Or add a class by typing its start and end. A new time becomes a period of the bell schedule.",
        ],
        tip: "A class that clashes with a teacher, room or section is not saved. The message says who and when, and suggests free times, rooms or teachers.",
      },
      {
        title: "Check the flags",
        roles: SCHEDULERS,
        what: [
          "Flags list what still needs care: missing minutes, no adviser, no room, an overloaded teacher.",
          "Each flag says how to fix it. Red ones must be fixed. Amber ones can be acknowledged with a reason.",
        ],
      },
      {
        title: "Submit for approval",
        roles: SCHEDULERS,
        what: ["Press Submit when the section is complete. It waits for the Admin and can no longer be edited."],
      },
    ],
  },
  {
    title: "Approve",
    intro: "The Admin.",
    steps: [
      {
        title: "Approve or reject",
        roles: ADMIN,
        where: { label: "Approvals", to: "/approvals" },
        what: [
          "Approve one section, a grade level, a department or everything waiting, after the summary.",
          "Reject with remarks: the scheduler revises the section and submits it again.",
          "To change an approved schedule, Reopen it with a reason.",
        ],
      },
    ],
  },
  {
    title: "Print and share",
    intro: "Once a section is approved.",
    steps: [
      {
        title: "Print the forms",
        roles: SCHEDULERS,
        where: { label: "Reports", to: "/reports" },
        what: [
          "Class Program (the official form), Teacher Program, Room Schedule, Adviser Summary and more, in PDF or CSV.",
        ],
      },
      {
        title: "Teachers and students see it",
        roles: SCHEDULERS,
        what: [
          "Teachers open My Schedule after signing in.",
          "Students and parents use View as Guest on the sign-in page, or the section's link or QR code.",
        ],
      },
    ],
  },
];
