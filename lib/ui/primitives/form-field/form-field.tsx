import { useId, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import s from "./form-field.module.css";

export interface FormFieldProps {
  label: ReactNode;
  /** Renders the input element. Receives an id to wire <label htmlFor>
      and the appropriate aria-describedby for helper / error text. */
  children: (controlProps: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Override the generated id. */
  id?: string;
  className?: string;
}

// Wraps a control with label + helper + error in the editorial layout
// (uppercase letter-spaced label above; helper / error below). The
// render-prop pattern keeps a11y wiring (id + aria-describedby) inside
// the primitive without forcing the caller to use a specific input type.
export function FormField({
  label,
  children,
  helper,
  error,
  required,
  id,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const helperId = helper ? `${controlId}-helper` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy =
    [errorId, helperId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn(s.field, className)}>
      <label htmlFor={controlId} className={s.label}>
        {label}
        {required && (
          <span className={s.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {helper && !error && (
        <span id={helperId} className={s.helper}>
          {helper}
        </span>
      )}
      {error && (
        <span id={errorId} className={s.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
