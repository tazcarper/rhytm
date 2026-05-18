import { createServerSupabaseClient } from "@/lib/supabase/server";

// Render on every request — this page hits the DB and has no business
// being prerendered. (Also avoids needing the anon key at build time.)
export const dynamic = "force-dynamic";

// Server Component. Reads the three seeded properties through the
// cookie-aware server client (anon key) — this is the smoke test for
// the App 1 scaffold: Next.js boots, Supabase env vars resolve, RLS
// allows the public read on `properties`. If this page renders three
// property names, every piece of the scaffold is wired correctly.
export default async function Home() {
  const supabase = await createServerSupabaseClient();

  const { data: properties, error } = await supabase
    .from("properties")
    .select("id, name, slug, timezone")
    .order("name");

  return (
    <main>
      <h1>Rhythm Outdoors</h1>
      <p>
        Booking platform scaffold. The list below comes from{" "}
        <code>public.properties</code> via the Supabase server client.
      </p>

      {error && (
        <pre
          style={{
            background: "#fee",
            border: "1px solid #f99",
            padding: "0.75rem",
            borderRadius: 6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          Error: {error.message}
        </pre>
      )}

      {properties && properties.length > 0 && (
        <ul>
          {properties.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>{" "}
              <code style={{ color: "#666" }}>
                ({p.slug} · {p.timezone})
              </code>
            </li>
          ))}
        </ul>
      )}

      {properties && properties.length === 0 && (
        <p>No properties found — check Phase 1 seed data.</p>
      )}
    </main>
  );
}
