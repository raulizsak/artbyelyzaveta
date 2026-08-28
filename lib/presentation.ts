const preservedWords = new Map([
  ["aud", "AUD"],
  ["gst", "GST"],
  ["api", "API"],
  ["id", "ID"],
]);

/** Formats machine-safe enum-like values for customer and admin presentation. */
export function formatDisplayValue(
  input: unknown,
  fallback = "Not specified",
) {
  if (typeof input !== "string" || !input.trim()) return fallback;
  return input
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      const preserved = preservedWords.get(word.toLowerCase());
      if (preserved) return preserved;
      if (/[A-Z].*[a-z]|[a-z].*[A-Z]/.test(word)) return word;
      const lower = word.toLocaleLowerCase("en-AU");
      return lower.charAt(0).toLocaleUpperCase("en-AU") + lower.slice(1);
    })
    .join(" ");
}
