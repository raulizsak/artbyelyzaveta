import { NextResponse, type NextRequest } from "next/server";
import {
  hasValidPreviewCookie,
  isPreviewGateEnabled,
  PREVIEW_COOKIE_NAME,
} from "@/lib/preview";

const publicPaths = new Set(["/", "/preview"]);

export async function proxy(request: NextRequest) {
  if (!isPreviewGateEnabled() || publicPaths.has(request.nextUrl.pathname))
    return NextResponse.next();

  const cookie = request.cookies.get(PREVIEW_COOKIE_NAME)?.value;
  if (await hasValidPreviewCookie(cookie)) return NextResponse.next();

  const destination = new URL("/preview", request.url);
  destination.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    "/((?!api|auth/callback|_next|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|txt|xml)$).*)",
  ],
};
