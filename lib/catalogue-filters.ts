import type { Painting } from "@/lib/catalog";

export const CATALOGUE_PAGE_SIZE = 24;
const availabilityValues = ["all", "available", "reserved", "sold"];
const orientationValues = ["all", "landscape", "portrait", "square", "other"];
const sortValues = ["featured", "newest", "price-asc", "price-desc"];

export function catalogueFilters(params: Pick<URLSearchParams, "get">) {
  const allowed = (key: string, values: string[], fallback: string) => {
    const value = params.get(key) ?? "";
    return values.includes(value) ? value : fallback;
  };
  const page = Number(params.get("page") ?? 1);
  return {
    availability: allowed("availability", availabilityValues, "all"),
    orientation: allowed("orientation", orientationValues, "all"),
    sort: allowed("sort", sortValues, "featured"),
    query: (params.get("q") ?? "").trim().slice(0, 200),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1000) : 1,
  };
}

/** Orientation describes the painting, never the proportions of its room photograph. */
export function paintingOrientation(
  painting: Pick<Painting, "widthCm" | "heightCm" | "orientation">,
) {
  if (painting.widthCm && painting.heightCm) {
    if (painting.widthCm === painting.heightCm) return "square";
    return painting.widthCm > painting.heightCm ? "landscape" : "portrait";
  }
  return painting.orientation;
}

export function filterPaintings(
  paintings: Painting[],
  filters: ReturnType<typeof catalogueFilters>,
) {
  const query = filters.query.toLocaleLowerCase("en-AU");
  return paintings
    .filter((painting) => {
      if (!["available", "reserved", "sold"].includes(painting.status))
        return false;
      if (
        filters.availability !== "all" &&
        painting.status !== filters.availability
      )
        return false;
      if (
        filters.orientation !== "all" &&
        paintingOrientation(painting) !== filters.orientation
      )
        return false;
      return (
        !query ||
        [
          painting.title,
          painting.description,
          painting.category,
          painting.medium,
          painting.surface,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("en-AU")
          .includes(query)
      );
    })
    .sort((a, b) => {
      if (filters.sort === "price-asc")
        return a.priceCents - b.priceCents || a.id.localeCompare(b.id);
      if (filters.sort === "price-desc")
        return b.priceCents - a.priceCents || a.id.localeCompare(b.id);
      if (filters.sort === "newest")
        return (
          b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
        );
      return (
        Number(b.featured) - Number(a.featured) ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id)
      );
    });
}
