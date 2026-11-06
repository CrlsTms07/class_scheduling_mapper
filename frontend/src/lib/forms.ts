import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/api/client";

/**
 * Shows API validation errors under their form fields.
 * Returns the message to show above the form when no field can display it.
 */
export function applyApiErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
): string | null {
  if (!(error instanceof ApiError)) {
    return "Cannot reach the server. Please check your connection and try again.";
  }

  const fieldNames = Object.keys(form.getValues());
  const fieldErrors = Object.entries(error.errors).filter(([field]) =>
    fieldNames.includes(field),
  );

  fieldErrors.forEach(([field, messages]) => {
    form.setError(field as Path<T>, { message: messages[0] });
  });

  return fieldErrors.length > 0 ? null : error.message;
}
