import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignUpSchema } from "@/types/FieldSchema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Link } from "react-router";
import AuthenticationLayout from "@/components/global-component/AuthenticationLayout";
import Container from "@/components/global-component/Container";
import FormAlert from "@/components/global-component/FormAlert";
import PasswordInput from "@/components/global-component/PasswordInput";
import { useSignUp } from "@/api/auth";
import { applyApiErrors } from "@/lib/forms";
import React from "react";
import * as z from "zod";

type SignUpValues = z.infer<typeof SignUpSchema>;

const NAME_FIELDS: {
  name: "first_name" | "middle_name" | "last_name" | "suffix";
  label: string;
  autoComplete: string;
}[] = [
  { name: "first_name", label: "First name", autoComplete: "given-name" },
  { name: "middle_name", label: "Middle name (optional)", autoComplete: "additional-name" },
  { name: "last_name", label: "Last name", autoComplete: "family-name" },
  { name: "suffix", label: "Suffix (optional)", autoComplete: "honorific-suffix" },
];

const BackToSignin = () => (
  <Link
    to="/"
    className={buttonVariants({ variant: "link", className: "h-11 px-0 text-xs" })}
  >
    <ArrowLeft />
    Back to Sign in
  </Link>
);

const SignUp = () => {
  const [formError, setFormError] = React.useState<string | null>(null);
  const signUp = useSignUp();
  const form = useForm<SignUpValues>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      first_name: "",
      middle_name: "",
      last_name: "",
      suffix: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });

  const handleSignUp = ({ confirmPassword, ...values }: SignUpValues) => {
    setFormError(null);
    signUp.mutate(
      { ...values, password_confirmation: confirmPassword },
      { onError: (error) => setFormError(applyApiErrors(form, error)) },
    );
  };

  return (
    <>
      <Container>
        <AuthenticationLayout
          title="Create your account"
          description="Use your official DepEd email. The Admin will activate your account."
        >
          {signUp.isSuccess ? (
            <div className="space-y-3">
              <FormAlert variant="success">{signUp.data.message}</FormAlert>
              <BackToSignin />
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(handleSignUp)} noValidate>
              <div className="space-y-5">
                {formError && <FormAlert>{formError}</FormAlert>}
                <div className="grid grid-cols-1 sm:grid-cols-2 landscape:grid-cols-2 gap-5">
                  {NAME_FIELDS.map(({ name, label, autoComplete }) => (
                    <Controller
                      key={name}
                      name={name}
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel
                            htmlFor={field.name}
                            className="text-sm text-neutral-800"
                          >
                            {label}
                          </FieldLabel>
                          <Input
                            {...field}
                            aria-invalid={fieldState.invalid}
                            id={field.name}
                            autoComplete={autoComplete}
                            className="h-11"
                          />
                          {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                          )}
                        </Field>
                      )}
                    />
                  ))}
                </div>
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel
                        htmlFor={field.name}
                        className="text-sm text-neutral-800"
                      >
                        DepEd email
                      </FieldLabel>
                      <Input
                        {...field}
                        aria-invalid={fieldState.invalid}
                        id={field.name}
                        type="email"
                        autoComplete="username"
                        className="h-11"
                        placeholder="juan.delacruz@deped.gov.ph"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="password"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel
                        htmlFor={field.name}
                        className="text-sm text-neutral-800"
                      >
                        Password
                      </FieldLabel>
                      <PasswordInput
                        {...field}
                        aria-invalid={fieldState.invalid}
                        id={field.name}
                        autoComplete="new-password"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="confirmPassword"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel
                        htmlFor={field.name}
                        className="text-sm text-neutral-800"
                      >
                        Confirm password
                      </FieldLabel>
                      <PasswordInput
                        {...field}
                        aria-invalid={fieldState.invalid}
                        id={field.name}
                        autoComplete="new-password"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
              <BackToSignin />
              <Button
                type="submit"
                className="w-full h-11 mt-4"
                disabled={signUp.isPending}
              >
                {signUp.isPending ? "Creating account..." : "Create account"}
              </Button>
            </form>
          )}
        </AuthenticationLayout>
      </Container>
    </>
  );
};

export default SignUp;
