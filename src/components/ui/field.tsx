"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

// Field layout (shadcn/ui "Field" pattern): one label, control, hint and
// error layout for every form. Two sizes:
//   - "default": the dashboard's compact look
//   - "lg": the event pages' larger look (see event-flow.module.css and the
//     event-pages-look decision): 20px group legends, 17px labels, 17px hints
// The size is set once on <FieldGroup> (or a lone <Field>) and read by the
// parts through context, so a form can't mix sizes by accident.

type FieldSize = "default" | "lg";

const FieldSizeContext = React.createContext<FieldSize>("default");
const useFieldSize = () => React.useContext(FieldSizeContext);

const groupVariants = cva("flex flex-col", {
  variants: { size: { default: "gap-5", lg: "gap-7" } },
  defaultVariants: { size: "default" },
});

function FieldGroup({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof groupVariants>) {
  const resolved = size ?? "default";
  return (
    <FieldSizeContext.Provider value={resolved}>
      <div data-slot="field-group" className={cn(groupVariants({ size: resolved }), className)} {...props} />
    </FieldSizeContext.Provider>
  );
}

const fieldVariants = cva("flex min-w-0 flex-col", {
  variants: {
    size: { default: "gap-1.5", lg: "gap-2" },
    orientation: { vertical: "", horizontal: "flex-row items-center gap-3" },
  },
  defaultVariants: { size: "default", orientation: "vertical" },
});

function Field({
  className,
  size,
  orientation,
  invalid,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants> & {
    // Marks the field as having an error (styles the label and control).
    invalid?: boolean;
  }) {
  const inherited = useFieldSize();
  const resolved = size ?? inherited;
  return (
    <FieldSizeContext.Provider value={resolved}>
      <div
        role="group"
        data-slot="field"
        data-invalid={invalid ? "true" : undefined}
        className={cn(fieldVariants({ size: resolved, orientation }), "group/field", className)}
        {...props}
      />
    </FieldSizeContext.Provider>
  );
}

const labelVariants = cva("font-sans leading-snug text-olive-darker group-data-[invalid=true]/field:text-accent-error", {
  variants: {
    size: {
      default: "text-sm font-medium",
      lg: "text-[17px] font-semibold text-olive",
    },
  },
  defaultVariants: { size: "default" },
});

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  const size = useFieldSize();
  return <label data-slot="field-label" className={cn(labelVariants({ size }), className)} {...props} />;
}

// "(optional)" after a label, in a quieter weight.
function FieldOptional({ className, children = "(optional)", ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="field-optional" className={cn("ml-1 font-normal text-gray", className)} {...props}>
      {children}
    </span>
  );
}

const descriptionVariants = cva("m-0 text-gray", {
  variants: { size: { default: "text-xs", lg: "text-[17px] leading-normal" } },
  defaultVariants: { size: "default" },
});

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  const size = useFieldSize();
  return <p data-slot="field-description" className={cn(descriptionVariants({ size }), className)} {...props} />;
}

const errorVariants = cva("m-0 font-semibold text-accent-error", {
  variants: { size: { default: "text-xs", lg: "text-[17px] leading-normal" } },
  defaultVariants: { size: "default" },
});

// Renders nothing without a message, so it can sit in every field. Accepts
// either text or React Hook Form's error object ({ message }).
function FieldError({
  className,
  children,
  error,
  ...props
}: React.ComponentProps<"p"> & { error?: { message?: string } | null }) {
  const size = useFieldSize();
  const message = children ?? error?.message;
  if (!message) return null;
  return (
    <p data-slot="field-error" role="alert" className={cn(errorVariants({ size }), className)} {...props}>
      {message}
    </p>
  );
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return <fieldset data-slot="field-set" className={cn("m-0 flex min-w-0 flex-col gap-3 border-0 p-0", className)} {...props} />;
}

// A legend heads a group of fields, so it sits a clear step above their
// labels (bigger and bolder), matching .groupTitle on the event pages.
const legendVariants = cva("mb-1 p-0 font-sans text-olive-darker", {
  variants: { size: { default: "text-base font-bold", lg: "text-[20px] font-bold" } },
  defaultVariants: { size: "default" },
});

function FieldLegend({ className, ...props }: React.ComponentProps<"legend">) {
  const size = useFieldSize();
  return <legend data-slot="field-legend" className={cn(legendVariants({ size }), className)} {...props} />;
}

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldOptional, FieldSet, useFieldSize };
export type { FieldSize };
