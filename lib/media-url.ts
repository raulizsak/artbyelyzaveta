export function publicArtworkUrl(path: unknown, siteUrl?: string) {
  if (typeof path !== "string" || !path.trim()) return "";
  const value = path.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/"))
    return siteUrl ? `${siteUrl.replace(/\/$/, "")}${value}` : value;
  if (value.startsWith("optimized/") || value.startsWith("artwork/"))
    return siteUrl ? `${siteUrl.replace(/\/$/, "")}/${value}` : `/${value}`;
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return supabase
    ? `${supabase}/storage/v1/object/public/artwork-public/${value}`
    : value;
}
