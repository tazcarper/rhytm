"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Card } from "@/lib/ui";
import { reportProblemAction } from "@/app/admin/events/feature-request-actions";

// "Report a problem": staff pick the live feature that's misbehaving (or
// say they're not sure) and describe what goes wrong, in their own words.

const NOT_SURE = "";

export function ReportProblemForm({
  features,
  canFix,
}: {
  features: ReadonlyArray<{ id: string; summary: string }>;
  canFix: boolean;
}) {
  const [featureId, setFeatureId] = useState<string>(features[0]?.id ?? NOT_SURE);
  const [problem, setProblem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const send = () => {
    setError(null);
    startTransition(async () => {
      const result = await reportProblemAction({ featureId: featureId || null, problem });
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  };

  if (sent) {
    return (
      <Card padding="default" elevation="soft">
        <p className="m-0 font-serif text-h4 font-semibold leading-snug text-olive-darker">Sent to Claude. It&apos;s looking into it now.</p>
        <p className="mt-2 max-w-[70ch] text-body leading-body text-olive">
          You can watch what it&apos;s doing, step by step, under{" "}
          <Link href="/admin/events/feature-requests" className="text-olive underline decoration-tan underline-offset-4">
            Feature requests
          </Link>
          . It usually takes 10 to 30 minutes. When the fix is ready, you&apos;ll find a link there to try it and a button to
          put it live.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="default" elevation="soft">
      <div className="flex flex-col gap-8">
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="mb-3 text-eyebrow font-semibold uppercase tracking-eyebrow text-tan">Which feature is it?</legend>
          {features.map((feature) => (
            <label key={feature.id} className="flex cursor-pointer items-start gap-3 text-body leading-snug text-olive-darker">
              <input
                type="radio"
                name="feature"
                className="mt-[3px] h-4 w-4 shrink-0 accent-olive"
                checked={featureId === feature.id}
                onChange={() => setFeatureId(feature.id)}
              />
              {feature.summary}
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-3 text-body leading-snug text-olive-darker">
            <input
              type="radio"
              name="feature"
              className="mt-[3px] h-4 w-4 shrink-0 accent-olive"
              checked={featureId === NOT_SURE}
              onChange={() => setFeatureId(NOT_SURE)}
            />
            Not sure, or something else
          </label>
        </fieldset>
        <label className="flex flex-col gap-2">
          <span className="text-eyebrow font-semibold uppercase tracking-eyebrow text-tan">What&apos;s going wrong?</span>
          <span className="max-w-[70ch] text-body leading-body text-olive">
            Say what you or the guest did, what you expected, and what happened instead. Write it the way you&apos;d tell a
            coworker.
          </span>
          <textarea
            value={problem}
            onChange={(evt) => setProblem(evt.target.value)}
            rows={6}
            maxLength={2000}
            className="mt-1 rounded-[2px] border border-rule-strong bg-white px-3 py-2.5 text-body leading-body text-olive-darker"
            placeholder="e.g. The early-bird price shows on the event page, but when a guest signs up after December 1 they're still charged $65."
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {canFix ? (
            <Button type="button" variant="primary" loading={isPending} disabled={problem.trim().length < 10} onClick={send}>
              Send to Claude
            </Button>
          ) : (
            <p className="m-0 text-micro text-gray">Automatic fixing isn&apos;t switched on yet. Ask your developer.</p>
          )}
          {error && <p className="m-0 text-body font-semibold text-accent-error">{error}</p>}
        </div>
      </div>
    </Card>
  );
}
