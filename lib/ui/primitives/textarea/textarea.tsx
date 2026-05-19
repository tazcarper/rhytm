import { type Ref, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import s from "./textarea.module.css";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
  invalid?: boolean;
}

export function Textarea({
  ref,
  className,
  invalid,
  "aria-invalid": ariaInvalid,
  ...rest
}: TextareaProps) {
  const isInvalid =
    invalid ?? (ariaInvalid === true || ariaInvalid === "true");
  return (
    <textarea
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn(s.textarea, isInvalid && s.invalid, className)}
      {...rest}
    />
  );
}
