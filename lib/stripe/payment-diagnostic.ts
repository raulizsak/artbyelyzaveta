/** Only safe text is exposed; never log an SDK error object or payment details. */
export function paymentDiagnostic(error: unknown): string {
  const details =
    error && typeof error === "object"
      ? (error as { name?: unknown; message?: unknown })
      : {};
  const name = typeof details.name === "string" ? details.name : "PaymentError";
  const message =
    typeof details.message === "string"
      ? details.message
      : "Stripe returned an unexpected error.";
  return `${name}: ${message}`
    .replace(/\b(?:sk|pk|rk)_(?:test|live)_[\w]+\b/g, "[redacted key]")
    .replace(/\b(?:cs|pi|seti)_[\w]+_secret_[^\s"']+/g, "[redacted secret]")
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, "[redacted email]")
    .replace(/\b(?:\d[ -]?){12,19}\b/g, "[redacted number]")
    .slice(0, 700);
}
