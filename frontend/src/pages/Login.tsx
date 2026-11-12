import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SigninSchema } from "@/types/FieldSchema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Link, useLocation, useNavigate } from "react-router";
import AuthenticationLayout from "@/components/global-component/AuthenticationLayout";
import Container from "@/components/global-component/Container";
import FormAlert from "@/components/global-component/FormAlert";
import PasswordInput from "@/components/global-component/PasswordInput";
import TermsDialog from "@/components/global-component/TermsDialog";
import { useLogin } from "@/api/auth";
import { applyApiErrors } from "@/lib/forms";
import { homePathFor } from "@/lib/navigation";
import React from "react";
import * as z from "zod";

const Login = () => {
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isTermsOpen, setIsTermsOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const form = useForm<z.infer<typeof SigninSchema>>({
    resolver: zodResolver(SigninSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onSubmit",
  });

  const handleSignin = (data: z.infer<typeof SigninSchema>) => {
    setFormError(null);
    login.mutate(data, {
      onSuccess: ({ data: user }) => {
        // Back to the page they tried to open, otherwise to their home page.
        navigate(location.state?.from ?? homePathFor(user.role), { replace: true });
      },
      onError: (error) => setFormError(applyApiErrors(form, error)),
    });
  };

  return (
    <>
      <Container>
        <AuthenticationLayout
          title="Sign in to your account"
          description="Enter your DepEd email below to access your account"
        >
          <form onSubmit={form.handleSubmit(handleSignin)} noValidate>
            <div className="space-y-6">
              {formError && <FormAlert>{formError}</FormAlert>}
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
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div>
                      <div className="flex justify-between items-center">
                        <FieldLabel
                          htmlFor={field.name}
                          className="text-sm text-neutral-800 mb-1"
                        >
                          Password
                        </FieldLabel>
                        <Link
                          to="/forgot-password"
                          className={buttonVariants({
                            variant: "link",
                            className: "h-11 px-0 text-xs",
                          })}
                        >
                          Forgot your password?
                        </Link>
                      </div>
                      <PasswordInput
                        {...field}
                        aria-invalid={fieldState.invalid}
                        id={field.name}
                        autoComplete="current-password"
                        placeholder="Your password"
                      />
                    </div>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
            <div className="mt-8 space-y-3">
              <Button
                type="submit"
                className="w-full h-11"
                disabled={login.isPending}
              >
                {login.isPending ? "Signing in..." : "Sign in"}
              </Button>
              <Link
                to="/guest"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full h-11",
                })}
              >
                View as Guest
              </Link>
              <p className="text-center text-sm text-neutral-700">
                No account yet?{" "}
                <Link
                  to="/signup"
                  className={buttonVariants({
                    variant: "link",
                    className: "h-11 px-1",
                  })}
                >
                  Sign up
                </Link>
              </p>
              <p className="text-center text-xs text-neutral-600">
                On your first sign-in you will be asked to accept the{" "}
                <button type="button" className="inline-flex min-h-11 items-center font-medium text-branding underline underline-offset-2" onClick={() => setIsTermsOpen(true)}>
                  Terms and Conditions
                </button>
                .
              </p>
            </div>
            <TermsDialog open={isTermsOpen} onOpenChange={setIsTermsOpen} />
          </form>
        </AuthenticationLayout>
      </Container>
    </>
  );
};

export default Login;
