// Force IPv4-first DNS resolution in the Node server process.
//
// On some networks (notably WSL) the machine advertises IPv6 but can't
// actually route it. Node/undici (which powers `fetch`) tries the IPv6
// address first and stalls until the 10s connect timeout before falling back
// — which made every request hang in proxy.ts on the Supabase auth call
// (`UND_ERR_CONNECT_TIMEOUT` to *.supabase.co:443). Resolving IPv4 first makes
// those connections complete instantly.
//
// `register()` runs once at server boot, before any request, so it covers the
// proxy + server actions + route handlers. Guarded to the Node runtime
// (node:dns isn't available on Edge). Harmless in prod, where IPv6 routes fine.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setDefaultResultOrder } = await import("node:dns");
    setDefaultResultOrder("ipv4first");
  }
}
