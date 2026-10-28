export function classifyEmailFailure(error: unknown) {
  const cause = (error && typeof error === "object" ? error : {}) as {
    code?: string;
    command?: string;
    responseCode?: number;
  };
  const response = Number(cause.responseCode);
  const diagnostic =
    [cause.code, cause.command, cause.responseCode]
      .filter((value) => typeof value === "string" || typeof value === "number")
      .map(String)
      .join(" / ")
      .slice(0, 200) || "SMTP outcome unavailable";
  if (response >= 400 && response < 500)
    return { outcome: "retry" as const, diagnostic };
  if (response >= 500 && response < 600)
    return { outcome: "permanent" as const, diagnostic };
  if (
    /^(CONN|EHLO|HELO|STARTTLS|AUTH|MAIL FROM|RCPT TO)$/i.test(
      cause.command ?? "",
    )
  )
    return { outcome: "retry" as const, diagnostic };
  // A timeout/reset after DATA may follow SMTP acceptance. Never blindly resend.
  return { outcome: "ambiguous" as const, diagnostic };
}
