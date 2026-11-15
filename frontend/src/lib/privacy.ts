/**
 * The Data Privacy Notice under Republic Act No. 10173 (Data Privacy Act of 2012): what the system
 * collects, why, who sees it, how long it is kept and the user's rights. Agreed to with its own box,
 * separate from the Terms and Conditions (team decision, Nov 16, 2026).
 */
export const privacyNotice = (schoolEmail?: string | null): { title: string; points: string[] }[] => [
  {
    title: "1. Who processes your information",
    points: [
      "Emmanuel Resurreccion Congressional Integrated High School (ERCIHS) runs this system to prepare, check and share its class schedules.",
      `For questions or requests about your information, contact the school's Data Protection Officer or the Admin${
        schoolEmail ? ` at ${schoolEmail}` : " through the school office"
      }.`,
    ],
  },
  {
    title: "2. What is collected",
    points: [
      "Account: your name, official DepEd email, password (kept only as a secure hash, never readable), role and grade levels.",
      "Teaching information: your personnel record (department, designation, shift, qualifications and teaching tasks), subjects, loading, advisory and schedules.",
      "Activity: sign-ins and the changes you make (for example, a schedule submitted or approved), kept for accountability.",
      "No student names or student records are collected.",
    ],
  },
  {
    title: "3. Why it is used",
    points: [
      "To make, check, approve and print class schedules and the school's official forms.",
      "To let you sign in, see your own schedule and profile, and receive notices such as a password reset or sign-in code.",
      "It is not sold, not used for advertising, and not shared outside the school except when the law requires it.",
    ],
  },
  {
    title: "4. Who can see it",
    points: [
      "The Admin, and the Chairperson or Master Teacher of your grade levels, as their work needs.",
      "Other personnel see only what their role needs. Teachers see their own schedule and profile.",
      "The public schedule shows only a section's approved timetable, its adviser and co-adviser.",
    ],
  },
  {
    title: "5. How it is kept",
    points: [
      "In a secured database reached only over encrypted connections, with access limited by role.",
      "Kept while your account is in use and as long as the school's records require; then removed or made anonymous.",
    ],
  },
  {
    title: "6. Your rights",
    points: [
      "To be informed, to access your information, and to have wrong information corrected.",
      "To object to processing, or to ask that your information be blocked or removed when it is no longer needed.",
      "To receive a copy of your information, and to file a complaint with the National Privacy Commission (privacy.gov.ph).",
    ],
  },
];
