type FormAlertProp = {
  variant?: "error" | "success";
  children: React.ReactNode;
};

const FormAlert = ({ variant = "error", children }: FormAlertProp) => {
  const colors =
    variant === "error"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-teal-700/30 bg-teal-700/5 text-teal-800";

  return (
    <p role="alert" className={`rounded-md border p-3 text-sm ${colors}`}>
      {children}
    </p>
  );
};

export default FormAlert;
