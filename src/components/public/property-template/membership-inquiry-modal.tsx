"use client";

import { useEffect, useRef, useState } from "react";
import { PropertyButton } from "./property-button";
import { MembershipInquiryForm } from "./membership-inquiry-form";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import s from "./membership-inquiry-modal.module.css";

type PropertyButtonVariant = NonNullable<Parameters<typeof PropertyButton>[0]["variant"]>;
type PropertyButtonSize = NonNullable<Parameters<typeof PropertyButton>[0]["size"]>;

interface MembershipInquiryModalProps {
  propertyId: string;
  triggerLabel: ReactNode;
  triggerVariant?: PropertyButtonVariant;
  triggerSize?: PropertyButtonSize;
  triggerClassName?: string;
  heading?: string;
  showHearAboutUs?: boolean;
  submitVariant?: "ink" | "primary";
}

// A CTA that used to anchor-scroll the page down to the on-page "Membership
// Inquiry" form (href="#inquiry") now opens that same form in a dialog
// instead — the guest never loses their place on the page. Each instance is
// self-contained (trigger + dialog + its own MembershipInquiryForm), same
// shape as WaiverSignModal; independent open state per call site is simpler
// than threading a single shared dialog through every CTA on the page.
export function MembershipInquiryModal({
  propertyId,
  triggerLabel,
  triggerVariant = "primary",
  triggerSize = "default",
  triggerClassName,
  heading = "Membership Inquiry",
  showHearAboutUs = false,
  submitVariant = "ink",
}: MembershipInquiryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      document.body.style.overflow = "";
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  const open = () => {
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
  };

  const close = () => {
    dialogRef.current?.close();
  };

  return (
    <>
      <PropertyButton
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={open}
      >
        {triggerLabel}
      </PropertyButton>

      <dialog
        ref={dialogRef}
        className={s.dialog}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <div className={s.sheet}>
          <header className={s.header}>
            <h2 className={s.title}>{heading}</h2>
            <button
              type="button"
              className={s.closeButton}
              onClick={close}
              aria-label="Close"
            >
              &times;
            </button>
          </header>
          <div className={s.body}>
            <MembershipInquiryForm
              propertyId={propertyId}
              showHearAboutUs={showHearAboutUs}
              submitVariant={submitVariant}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}
