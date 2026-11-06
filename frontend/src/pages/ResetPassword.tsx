import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ResetPasswordSchema } from "@/types/FieldSchema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import AuthenticationLayout from "@/components/global-component/AuthenticationLayout";
import Container from "@/components/global-component/Container";
import FormAlert from "@/components/global-component/FormAlert";
import PasswordInput from "@/components/global-component/PasswordInput";
import { useResetPassword } from "@/api/auth";
import { applyApiErrors } from "@/lib/forms";
import React from "react";
import * as z from "zod";
import { Link, useSearchParams } from "react-router";

const BackToSignin = () => (
  <Link
    to="/"
    className={buttonVariants({ variant: "link", className: "h-11 px-0 text-xs" })}
  >
    <ArrowLeft />
    Back to Sign in
  </Link>
);

const ResetPassword = () => {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const resetPassword = useResetPassword();

  const form = useForm<z.infer<typeof ResetPasswordSchema>>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });

  const handleSubmit = (data: z.infer<typeof ResetPasswordSchema>) => {
    setFormError(null);
    resetPassword.mutate(
      {
        token: token ?? "",
        email: email ?? "",
        password: data.password,
        password_confirmation: data.confirmPassword,
      },
      { onError: (error) => setFormError(applyApiErrors(form, error)) },
    );
  };

  const renderContent = () => {
    if (!token || !email) {
      return (
        <div className="space-y-3">
          <FormAlert>
            This reset link is incomplete. Please request a new one.
          </FormAlert>
          <BackToSignin />
        </div>
      );
    }

    if (resetPassword.isSuccess) {
      return (
        <div className="space-y-3">
          <FormAlert variant="success">{resetPassword.data.message}</FormAlert>
          <BackToSignin />
        </div>
      );
    }

    return (
      <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
        <div className="space-y-6">
          {formError && <FormAlert>{formError}</FormAlert>}
          <p className="text-sm text-neutral-700">
            Account: <span className="font-medium break-all">{email}</span>
          </p>
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor={field.name}
                  className="text-sm text-neutral-800"
                >
                  New Password
                </FieldLabel>
                <PasswordInput
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  autoComplete="new-password"
                  placeholder="Enter your password"
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
                  Confirm Password
                </FieldLabel>
                <PasswordInput
                  {...field}
                  aria-invalid={fieldState.invalid}
                  id={field.name}
                  autoComplete="new-password"
                  placeholder="Enter your password"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </div>
        <Button
          type="submit"
          className="w-full h-11 mt-8"
          disabled={resetPassword.isPending}
        >
          {resetPassword.isPending ? "Saving..." : "Save new password"}
        </Button>
      </form>
    );
  };

  return (
    <>
      <Container>
        <AuthenticationLayout
          title="Reset Password"
          description="Almost there! Choose a new password you'll remember."
        >
          {renderContent()}
        </AuthenticationLayout>
      </Container>
    </>
  );
};

export default ResetPassword;
