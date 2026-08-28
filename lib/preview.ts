export const PREVIEW_COOKIE_NAME = "abe-preview-access";
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();
const tokenMessage = "art-by-elyzaveta-preview-access-v1";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

export function isPreviewGateEnabled() {
  return process.env.PREVIEW_GATE_ENABLED === "true";
}

export async function createPreviewCookieValue() {
  const secret = process.env.PREVIEW_COOKIE_SECRET?.trim();
  if (!secret) throw new Error("Preview cookie secret is not configured");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(tokenMessage),
  );
  return `v1.${toBase64Url(new Uint8Array(signature))}`;
}

export async function hasValidPreviewCookie(value?: string) {
  if (!value) return false;
  try {
    const expected = await createPreviewCookieValue();
    return equalBytes(await digest(value), await digest(expected));
  } catch {
    return false;
  }
}

export async function isCorrectPreviewPassword(candidate: string) {
  const expected = process.env.PREVIEW_PASSWORD ?? "";
  if (!expected) return false;
  return equalBytes(await digest(candidate), await digest(expected));
}

export function safePreviewNext(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "/home";
  return value;
}
