import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOffIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ResetPasswordSchema } from "@/types/FieldSchema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import AuthenticationLayout from "@/layout/AuthenticationLayout";
import Container from "@/layout/Container";
import React from "react";
import * as z from "zod";

const ResetPassword = () => {
  const [isPassword, setIsPassword] = React.useState(false);

  const form = useForm<z.infer<typeof ResetPasswordSchema>>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });
  return (
    <>
      <Container>
        <AuthenticationLayout
          title="Reset Password"
          description="Almost there! Choose a new password you’ll remember."
        >
          <div>
            <form onSubmit={form.handleSubmit((data) => console.log(data))}>
              <div className="space-y-10">
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
                <Controller
                  name="password"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <div>
                        <FieldLabel
                          htmlFor={field.name}
                          className="text-sm text-neutral-800 mb-1"
                        >
                          New Password
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            {...field}
                            aria-invalid={fieldState.invalid}
                            placeholder="Enter your password"
                            type={!isPassword ? "password" : "text"}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              aria-label="Copy"
                              title="Copy"
                              size="icon-xs"
                              onClick={() => setIsPassword(!isPassword)}
                            >
                              {!isPassword ? <EyeOffIcon /> : <Eye />}
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                      </div>
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
                      <div>
                        <FieldLabel
                          htmlFor={field.name}
                          className="text-sm text-neutral-800 mb-1"
                        >
                          Confirm Password
                        </FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            {...field}
                            aria-invalid={fieldState.invalid}
                            placeholder="Enter your password"
                            type="password"
                          />
                        </InputGroup>
                      </div>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
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

export default ResetPassword;
