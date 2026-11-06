import * as z from "zod";

const EmailPassword = {
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .pipe(z.email("Enter a valid email address")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password must be at most 64 characters")
    .regex(/[a-z]/, "Include at least one lowercase letter")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[0-9]/, "Include at least one number")
    .regex(/[^A-Za-z0-9]/, "Include at least one special character"),
};

const DepEdEmail = EmailPassword.email.refine(
  (email) => email.toLowerCase().endsWith("@deped.gov.ph"),
  "Use your official DepEd email (@deped.gov.ph)",
);

export const SigninSchema = z.object({
  email: DepEdEmail,
  password: z.string().min(1, "Password is required"),
});

export const SignUpSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required").max(60),
    middle_name: z.string().trim().max(60),
    last_name: z.string().trim().min(1, "Last name is required").max(60),
    suffix: z.string().trim().max(10),
    email: DepEdEmail,
    password: EmailPassword.password,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const ForgotPasswordSchema = z.object({
  email: EmailPassword.email,
});

export const ResetPasswordSchema = z
  .object({
    password: EmailPassword.password,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const AddClassSchedule = z
  .object({
    section: z.string().trim().min(1, "Section is required."),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format (e.g. 08:30)"),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format (e.g. 08:30)"),
    subject: z.string().trim().min(1, "Subject is required."),
    teacher: z.string().trim().min(1, "Teacher is required."),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const SectionSchema = z.object({
  gradeLevel: z.string().min(1, "Please select a grade level"),
  section: z.string().min(1, "Please select a section"),
});
