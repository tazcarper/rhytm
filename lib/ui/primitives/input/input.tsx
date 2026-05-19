import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import s from "./input.module.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, "aria-invalid": ariaInvalid, ...rest },
  ref,
) {
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
});
