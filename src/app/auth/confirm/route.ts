import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Where the "confirm your email" link lands after a coach signs up.
// Handles both link styles Supabase can send: ?code=… (PKCE) and ?token_hash=…&type=…
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const supabase = await createSupabaseServerClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  // The email is confirmed even when the session can't be started here (e.g. the link was
  // opened on a different device from the one used to sign up), so send them to sign in.
  return NextResponse.redirect(new URL(ok ? "/coach" : "/coach/sign-in?confirmed=1", origin));
}
