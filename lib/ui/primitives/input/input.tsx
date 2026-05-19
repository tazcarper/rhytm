import { type InputHTMLAttributes, type Ref } from "react";
import { cn } from "../../utils/cn";
import s from "./input.module.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
  invalid?: boolean;
}

export function Input({
  ref,
  className,
  invalid,
  "aria-invalid": ariaInvalid,
  ...rest
}: InputProps) {
  const isInvalid =
    invalid ?? (ariaInvalid === true || ariaInvalid === "true");
  return (
    <input
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn(s.input, isInvalid && s.invalid, className)}
      {...rest}
    />
  );
}
