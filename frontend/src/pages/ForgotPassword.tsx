import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ForgotPasswordSchema } from "@/types/FieldSchema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import AuthenticationLayout from "@/components/global-component/AuthenticationLayout";
import Container from "@/components/global-component/Container";
import FormAlert from "@/components/global-component/FormAlert";
import { useForgotPassword } from "@/api/auth";
import { applyApiErrors } from "@/lib/forms";
import React from "react";
import * as z from "zod";
import { Link } from "react-router";

const ForgotPassword = () => {
  const [formError, setFormError] = React.useState<string | null>(null);
  const forgotPassword = useForgotPassword();
  const form = useForm<z.infer<typeof ForgotPasswordSchema>>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: "",
    },
    mode: "onSubmit",
  });

  const handleSubmit = (data: z.infer<typeof ForgotPasswordSchema>) => {
    setFormError(null);
    forgotPassword.mutate(data, {
      onError: (error) => setFormError(applyApiErrors(form, error)),
    });
  };

  return (
    <>
      <Container>
        <AuthenticationLayout
          title="Forgot Password"
          description="Enter your email and we will send you a link to choose a new password."
        >
          <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
            <div className="space-y-5">
              {formError && <FormAlert>{formError}</FormAlert>}
              {forgotPassword.isSuccess && (
                <FormAlert variant="success">
                  {forgotPassword.data.message} Check your inbox and spam folder.
                </FormAlert>
              )}
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      htmlFor={field.name}
                      className="text-sm text-neutral-800"
                    >
                      Email
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
            </div>
            <Link
              to="/login"
              className={buttonVariants({
                variant: "link",
                className: "h-11 px-0 text-xs mt-3",
              })}
            >
              <ArrowLeft />
              Back to Sign in
            </Link>
            <Button
              type="submit"
              className="w-full h-11 mt-4"
              disabled={forgotPassword.isPending}
            >
              {forgotPassword.isPending ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </AuthenticationLayout>
      </Container>
    </>
  );
};

export default ForgotPassword;
