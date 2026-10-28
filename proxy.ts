import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  hasValidPreviewCookie,
  isPreviewGateEnabled,
  PREVIEW_COOKIE_NAME,
} from "@/lib/preview";

const publicPaths = new Set(["/", "/preview"]);

export async function proxy(request: NextRequest) {
  if (isPreviewGateEnabled() && !publicPaths.has(request.nextUrl.pathname)) {
    const cookie = request.cookies.get(PREVIEW_COOKIE_NAME)?.value;
    if (!(await hasValidPreviewCookie(cookie))) {
      const destination = new URL("/preview", request.url);
      destination.searchParams.set(
        "next",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );
      return NextResponse.redirect(destination);
    }
  }
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key && /^\/(account|admin)(\/|$)/.test(request.nextUrl.pathname)) {
    // Server Components cannot persist refreshed cookies. Refresh at the proxy
    // boundary, then let the existing page/API guards authorize each operation.
    const supabase = createServerClient(url, key, {
      global: { fetch: fetchWithTimeout },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values, headers) => {
          for (const { name, value } of values)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of values)
            response.cookies.set(name, value, options);
          for (const [name, value] of Object.entries(headers ?? {}))
            response.headers.set(name, value);
        },
      },
    });
    await supabase.auth.getClaims();
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|auth/callback|_next|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|txt|xml)$).*)",
  ],
};
