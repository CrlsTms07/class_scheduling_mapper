import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type FormTextFieldProp<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  type?: "text" | "date" | "time" | "email";
  placeholder?: string;
  disabled?: boolean;
  /** Needed when one page has the same field in several forms, so each id stays unique. */
  idPrefix?: string;
};

/** A labelled input with its error message, 44px tall for phones. */
const FormTextField = <T extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  placeholder,
  disabled,
  idPrefix = "",
}: FormTextFieldProp<T>) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={`${idPrefix}${name}`} className="text-sm text-neutral-800">
          {label}
        </FieldLabel>
        <Input
          {...field}
          value={field.value as string}
          id={`${idPrefix}${name}`}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={fieldState.invalid}
          className="h-11"
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);

export default FormTextField;
