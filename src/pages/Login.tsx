import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SigninSchema } from "@/types/FieldSchema";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { NavLink, useNavigate } from "react-router";
import AuthenticationLayout from "@/components/global-component/AuthenticationLayout";
import Container from "@/components/global-component/Container";
import React from "react";
import * as z from "zod";

const Login = () => {
  const [isPassword, setIsPassword] = React.useState(false);
  const navigate = useNavigate();
  const form = useForm<z.infer<typeof SigninSchema>>({
    resolver: zodResolver(SigninSchema),
    defaultValues: {
      username: "",
      password: "",
    },
    mode: "onSubmit",
  });

  const handleSignin = (data: z.infer<typeof SigninSchema>) => {
    console.log(data);
    navigate("index");
  };
  return (
    <>
      <Container>
        <AuthenticationLayout
          title="Sign in to your account"
          description="Enter your username below to access to your account"
        >
          <form onSubmit={form.handleSubmit((data) => handleSignin(data))}>
            <div className="space-y-6">
              <Controller
                name="username"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      htmlFor={field.name}
                      className="text-sm text-neutral-800"
                    >
                      Username
                    </FieldLabel>
                    <Input
                      {...field}
                      aria-invalid={fieldState.invalid}
                      id="username"
                      placeholder="SampleUserName2026"
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
                      <div className="flex justify-between">
                        <Label className="text-sm text-neutral-800 mb-1">
                          Password
                        </Label>
                        <NavLink to="forgot-password">
                          <Button
                            type="button"
                            variant="link"
                            className="text-xs"
                          >
                            Forgot your password?
                          </Button>
                        </NavLink>
                      </div>
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
            </div>
            <div>
              <Button type="submit" className="w-full mt-10">
                Signin
              </Button>
            </div>
          </form>
        </AuthenticationLayout>
      </Container>
    </>
  );
};

export default Login;
