// Public surface of the design system. Callers import from "@/lib/ui"
// only — sub-paths are an internal implementation detail.

export { Alert } from "./primitives/alert";
export type { AlertProps, AlertVariant } from "./primitives/alert";

export { Badge } from "./primitives/badge";
export type { BadgeProps, BadgeVariant } from "./primitives/badge";

export { Button } from "./primitives/button";
export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
} from "./primitives/button";

export { Card } from "./primitives/card";
export type { CardProps } from "./primitives/card";

export { Divider } from "./primitives/divider";
export type { DividerProps } from "./primitives/divider";

export { Eyebrow } from "./primitives/eyebrow";
export type { EyebrowProps } from "./primitives/eyebrow";

export { FormField } from "./primitives/form-field";
export type { FormFieldProps } from "./primitives/form-field";

export { Heading } from "./primitives/heading";
export type {
  HeadingProps,
  HeadingLevel,
  HeadingSize,
} from "./primitives/heading";

export { Input } from "./primitives/input";
export type { InputProps } from "./primitives/input";

export { PageShell } from "./primitives/page-shell";
export type { PageShellProps } from "./primitives/page-shell";

export { Textarea } from "./primitives/textarea";
export type { TextareaProps } from "./primitives/textarea";

export { cn } from "./utils/cn";
