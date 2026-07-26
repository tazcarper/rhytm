import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPublicAdventures } from "@/src/services/public/adventures";
import { getActivePromotions } from "@/src/services/public/promotions";
import { AdventureTile } from "@/src/components/public/adventure-tile";
import { PromotionBand } from "@/src/components/public/promotion-band";
import { Alert } from "@/lib/ui";
import s from "./adventures-index.module.css";

export const dynamic = "force-dynamic";

// Public adventures index — an editorial browse. Atmospheric masthead, a
// large lead feature, then an immersive image-forward grid. Anyone can
// view (data via the SECURITY DEFINER public_member_adventures RPC);
// sign-up happens on each detail page, gated to members.
export default async function AdventuresIndexPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, promotions] = await Promise.all([
    getPublicAdventures(supabase),
    getActivePromotions(supabase, { placement: "adventures_page" }),
  ]);
  const adventures = data ?? [];
  const [feature, ...rest] = adventures;

  return (
    <main className={s.page}>
      <header className={s.masthead}>
        <div className={s.mastheadInner}>
          <div className={s.eyebrow}>Member Adventures</div>
          <h1 className={s.headline}>
            Where we&rsquo;re <em>going next</em>
          </h1>
          <div className={s.rule} aria-hidden />
          <p className={s.deck}>
            Curated journeys and signature experiences — a members&rsquo;
            privilege. Open to wander; reserved to book.
          </p>
        </div>
      </header>

      <PromotionBand promotions={promotions} />

      {error && (
        <div className={s.notice}>
          <Alert variant="error" title="Could not load adventures">
            {error.message}
          </Alert>
        </div>
      )}

      {adventures.length > 0 && (
        <div className={s.collection}>
          {feature && <AdventureTile adventure={feature} feature index={3} />}
          {rest.length > 0 && (
            <div className={s.grid}>
              {rest.map((adventure, i) => (
                <AdventureTile key={adventure.id} adventure={adventure} index={i + 4} />
              ))}
            </div>
          )}
        </div>
      )}

      {!error && adventures.length === 0 && (
        <div className={s.notice}>
          <Alert variant="info" title="No adventures open right now">
            Curated trips for the membership are listed here as they&rsquo;re
            scheduled. Check back soon.
          </Alert>
        </div>
      )}
    </main>
  );
}
