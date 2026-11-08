import Link from "next/link";
import { Eyebrow, Heading, PageShell } from "@/lib/ui";
import {
  REWARDS_TERMS,
  REWARDS_TERMS_EFFECTIVE_DATE,
} from "@/src/constants/rewards/terms";

// Member Rewards Program terms. Linked from the bottom of the member
// profile; members-only by design (the client chose not to publish it on
// the public site). Content lives in src/constants/rewards/terms.ts.
export default function RewardsTermsPage() {
  return (
    <PageShell width="narrow">
      <Eyebrow as="div" className="mb-2">
        Member
      </Eyebrow>
      <Heading level={1} size="h1" underline>
        Rewards program <em>terms</em>
      </Heading>
      <p className="text-gray text-[14px] mt-2">Effective {REWARDS_TERMS_EFFECTIVE_DATE}</p>

      <div className="mt-8 flex flex-col gap-8">
        {REWARDS_TERMS.map((section) => (
          <section key={section.heading}>
            <Heading level={2} size="h3">
              {section.heading}
            </Heading>
            {section.paragraphs.map((text) => (
              <p key={text.slice(0, 40)} className="mt-3 mb-0 text-[15px] leading-relaxed">
                {text}
              </p>
            ))}
          </section>
        ))}
      </div>

      <p className="mt-12 pt-4 border-t border-rule text-[13px] text-gray">
        <Link href="/member/profile" className="underline">
          Back to your profile
        </Link>
      </p>
    </PageShell>
  );
}
