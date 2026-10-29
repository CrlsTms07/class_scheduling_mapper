import { cn } from "cn";
import React from "react";

const Container = ({
  children,
  className,
}: {
  children: React.ReactElement;
  className?: string;
}) => {
  return <div className={cn("mx-auto w-full", className)}>{children}</div>;
};

export default Container;
