import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const enabled = process.env.ENABLE_SEARCH_INDEXING === "true";
  return {
    rules: enabled
      ? { userAgent: "*", allow: "/", disallow: ["/account/", "/admin/"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: enabled
      ? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://artbyelyzaveta.shop"}/sitemap.xml`
      : undefined,
  };
}
