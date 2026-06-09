"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/lib/ui";
import { submitBookingWaiverScanAction } from "@/app/(public)/sign-waiver/[token]/actions";

const labelCls = "block font-sans text-[12px] tracking-[0.5px] uppercase text-gray mb-1";
const inputCls =
  "w-full border border-rule rounded px-3 py-2.5 font-serif text-[17px] text-olive focus:border-olive focus:outline-none bg-paper";

// Per-person waiver signing reached by scanning a booking's QR. Each guest
// signs on their own phone; resets so the next person can sign too.
export function TokenWaiverSignForm({
  token,
  consentText,
}: {
  token: string;
  consentText: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [company, setCompany] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [signedName, setSignedName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitBookingWaiverScanAction(token, {
        name,
        email,
        agreedConsent: agreed,
        honeypot: company,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSignedName(name.trim());
    });
  };

  const reset = () => {
    setName("");
    setEmail("");
    setAgreed(false);
    setError(null);
    setSignedName(null);
  };

  if (signedName) {
    return (
      <div className="text-center py-6">
        <div className="font-serif text-[28px] text-olive mb-2">Signed ✓</div>
        <p className="font-serif text-[17px] text-gray m-0">
          Thank you, {signedName}. Your waiver is on file.
        </p>
        <div className="mt-6">
          <Button type="button" variant="primary" size="lg" onClick={reset}>
            Next person
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="error" title="Couldn't sign">
          {error}
        </Alert>
      )}
      <input
        type="text"
        name="company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <label className="block">
        <span className={labelCls}>Full legal name</span>
        <input
          className={inputCls}
          value={name}
          placeholder="Jane Doe"
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Email</span>
        <input
          className={inputCls}
          type="email"
          inputMode="email"
          value={email}
          placeholder="you@example.com"
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="flex items-start gap-3 mt-1 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5 flex-none"
        />
        <span className="font-serif text-[15px] text-olive leading-[1.5]">{consentText}</span>
      </label>
      <div className="mt-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          loading={isPending}
          disabled={isPending || !name || !email || !agreed}
          onClick={submit}
        >
          {isPending ? "Signing…" : "Sign waiver"}
        </Button>
      </div>
    </div>
  );
}
