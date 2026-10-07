// NEXT_PUBLIC_ values are inlined into browser code at build time, so they must be read
// with the full literal name (no dynamic process.env[name] lookups).

export function supabaseUrl() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set (see .env.example)");
  return v;
}

export function supabasePublishableKey() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set (see .env.example)");
  return v;
}
