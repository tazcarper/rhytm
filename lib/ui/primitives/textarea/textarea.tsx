import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";
import s from "./textarea.module.css";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { className, invalid, "aria-invalid": ariaInvalid, ...rest },
    ref,
  ) {
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
  },
);
