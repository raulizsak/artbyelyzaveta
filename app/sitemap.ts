import type { MetadataRoute } from "next";
import { POLICIES } from "@/lib/policies";
import { SITE_URL } from "@/lib/site";
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/shop",
    "/shop/cows-at-dusk",
    "/about",
    "/commissions",
    "/contact",
    ...POLICIES.map((policy) => `/policies/${policy.slug}`),
  ];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date("2026-08-21"),
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1 : route.includes("cows-at-dusk") ? 0.9 : 0.7,
  }));
}
