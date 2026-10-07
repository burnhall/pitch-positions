import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs before every page request: keeps the Supabase login fresh (rewriting its cookies when
// the access token is renewed) and sends signed-out visitors to the right sign-in page.
// Pages and actions still check access themselves; this is only the fast first pass.

const PUBLIC_COACH_PAGES = ["/coach/sign-in", "/coach/sign-up"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        for (const { name, value } of cookies) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // Must run before the response is used, so a renewed session gets written back.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  const { pathname } = request.nextUrl;
  const to = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  };

  if (!signedIn && pathname.startsWith("/coach") && !PUBLIC_COACH_PAGES.includes(pathname)) return to("/coach/sign-in");
  if (!signedIn && pathname.startsWith("/play") && pathname !== "/play/login") return to("/play/login");

  return response;
}

export const config = {
  // Everything except static files and images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
