import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPreviewCookieValue,
  isCorrectPreviewPassword,
  isPreviewGateEnabled,
  PREVIEW_COOKIE_MAX_AGE,
  PREVIEW_COOKIE_NAME,
  safePreviewNext,
} from "@/lib/preview";

const schema = z.object({
  password: z.string().min(1).max(200),
  next: z.string().max(2000).optional(),
});

const attempts = new Map<string, { count: number; resetAt: number }>();

function withinPreviewLimit(request: Request) {
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (current.count >= 12) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  if (!isPreviewGateEnabled()) return NextResponse.json({ next: "/home" });

  if (!withinPreviewLimit(request))
    return NextResponse.json(
      { error: "Too many attempts. Please wait a little before trying again." },
      { status: 429 },
    );

  const parsed = schema.safeParse(await request.json());
  if (
    !parsed.success ||
    !(await isCorrectPreviewPassword(parsed.data.password))
  )
    return NextResponse.json(
      { error: "That preview password is not correct." },
      { status: 401 },
    );

  const response = NextResponse.json({
    next: safePreviewNext(parsed.data.next),
  });
  response.cookies.set({
    name: PREVIEW_COOKIE_NAME,
    value: await createPreviewCookieValue(),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PREVIEW_COOKIE_MAX_AGE,
    priority: "high",
  });
  return response;
}
