import React from "react";
import { Eye, EyeOffIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

const PasswordInput = (
  props: Omit<React.ComponentProps<typeof InputGroupInput>, "type">,
) => {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <InputGroup className="h-11">
      <InputGroupInput
        {...props}
        className="h-full"
        type={isVisible ? "text" : "password"}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          aria-label={isVisible ? "Hide password" : "Show password"}
          size="icon-xs"
          className="size-11"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? <Eye /> : <EyeOffIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
};

export default PasswordInput;
