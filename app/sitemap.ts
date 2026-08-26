import type { MetadataRoute } from "next";
import { getPaintings } from "@/lib/catalog-data";
import { POLICIES } from "@/lib/policies";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paintings = await getPaintings();
  const staticRoutes = [
    "",
    "/shop",
    "/about",
    "/commissions",
    "/contact",
    ...POLICIES.map((policy) => `/policies/${policy.slug}`),
  ];
  const staticEntries = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date("2026-08-26"),
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1 : 0.7,
  }));
  const paintingEntries = paintings.map((painting) => ({
    url: `${SITE_URL}/shop/${painting.slug}`,
    lastModified: new Date(painting.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));
  return [...staticEntries, ...paintingEntries];
}
