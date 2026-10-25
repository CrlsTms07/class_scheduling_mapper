import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronLeft, Eye, EyeOffIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ForgotPasswordSchema } from "@/types/FieldSchema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import AuthenticationLayout from "@/layout/AuthenticationLayout";
import Container from "@/layout/Container";
import React from "react";
import * as z from "zod";
import { NavLink } from "react-router";

const ForgotPassword = () => {
  const [isPassword, setIsPassword] = React.useState(false);

  const form = useForm<z.infer<typeof ForgotPasswordSchema>>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: "",
    },
    mode: "onSubmit",
  });
  return (
    <>
      <Container>
        <AuthenticationLayout
          title="Forgot Password"
          description="If an account exists for that email, we’ve sent a password reset link. Check your inbox and spam folder."
        >
          <div className="px-16">
            <form onSubmit={form.handleSubmit((data) => console.log(data))}>
              <div className="flex justify-center">
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
                        id="email"
                        placeholder="email@sample.com"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
              <NavLink to="/">
                <Button variant="link" className="text-xs mt-3">
                  <ArrowLeft />
                  Back to Signin
                </Button>
              </NavLink>
              <div>
                <Button type="submit" className="w-full mt-10">
                  Submit
                </Button>
              </div>
            </form>
          </div>
        </AuthenticationLayout>
      </Container>
    </>
  );
};

export default ForgotPassword;
