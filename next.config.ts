import type { NextConfig } from "next";

// Hostname of the Supabase project's public Storage, derived from the same
// env var the clients use — so uploaded adventure images
// (…supabase.co/storage/v1/object/public/…) are optimizable by next/image
// across every environment without hardcoding the project ref.
const supabaseHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hosts next/image is allowed to optimize. Keep in sync with the
  // OPTIMIZABLE_HOSTS allowlist in src/components/public/adventure-image.tsx
  // (which falls back to a plain <img> for any host not listed here, so an
  // arbitrary pasted URL can never crash a public page).
  images: {
    remotePatterns: [
      // Real uploaded imagery — scoped to the public bucket path.
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // Seed/placeholder imagery (Lorem Picsum, which serves bytes from its
      // Fastly CDN after a redirect).
      { protocol: "https" as const, hostname: "picsum.photos" },
      { protocol: "https" as const, hostname: "fastly.picsum.photos" },
    ],
  },
  // Serve the static platform guide (public/guide.html) at a clean /guide URL.
  async rewrites() {
    return [{ source: "/guide", destination: "/guide.html" }];
  },
};

export default nextConfig;
