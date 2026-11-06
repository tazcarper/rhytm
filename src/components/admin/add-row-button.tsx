"use client";

import type { ButtonHTMLAttributes } from "react";
import { Plus } from "lucide-react";
import formStyles from "@/src/components/admin/form-styles.module.css";

// "Add a row" button for dashboard forms (add a chapter, a gear item, a
// set of hours). Dashed outline + plus icon so it never reads as an empty
// input or as the form's main action.
export function AddRowButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className={className ? `${formStyles.add} ${className}` : formStyles.add}>
      <Plus aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.25} />
      {children}
    </button>
  );
}
