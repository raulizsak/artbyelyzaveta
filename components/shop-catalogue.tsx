"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import Drawer from "@/components/smoothui/drawer";
import { PaintingCard } from "@/components/painting-card";
import { api } from "@/convex/_generated/api";
import { COWS_AT_DUSK, type Painting } from "@/lib/catalog";

export function ShopCatalogue() {
  const params = useSearchParams();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [availability, setAvailability] = useState("all");
  const [sort, setSort] = useState("featured");
  const catalogue = useQuery(api.paintings.listPublished);
  const painting = (catalogue?.[0] ?? COWS_AT_DUSK) as Painting;
  const query = (params.get("q") ?? "").toLowerCase();
  const visible = useMemo(() => {
    if (availability === "sold") return false;
    return (
      !query ||
      `${painting.title} ${painting.category} ${painting.medium} landscape animal`
        .toLowerCase()
        .includes(query)
    );
  }, [availability, painting, query]);

  const filters = (
    <div className="filter-fields">
      <label>
        Availability
        <select
          onChange={(e) => setAvailability(e.target.value)}
          value={availability}
        >
          <option value="all">All works</option>
          <option value="available">Available</option>
          <option value="sold">Sold</option>
        </select>
      </label>
      <label>
        Sort by
        <select onChange={(e) => setSort(e.target.value)} value={sort}>
          <option value="featured">Featured</option>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </label>
      <label>
        Orientation
        <select defaultValue="landscape">
          <option value="all">All orientations</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
    </div>
  );

  return (
    <>
      <div className="catalogue-toolbar">
        <p>
          {visible ? "1 original" : "No originals"}
          {query ? ` matching “${params.get("q")}”` : ""}
        </p>
        <div className="desktop-filters">{filters}</div>
        <button
          className="filter-button"
          onClick={() => setFiltersOpen(true)}
          type="button"
        >
          <SlidersHorizontal aria-hidden="true" size={17} /> Filters
        </button>
      </div>
      {query ? (
        <button
          className="active-filter"
          onClick={() => router.push("/shop")}
          type="button"
        >
          Search: {params.get("q")} <X aria-hidden="true" size={14} />
        </button>
      ) : null}
      {visible ? (
        <div className="catalogue-grid">
          <PaintingCard painting={painting} />
        </div>
      ) : (
        <div className="empty-state catalogue-empty">
          <h2>No works found</h2>
          <p>
            Try changing the availability filter or searching for “landscape”.
          </p>
          <button
            className="text-button"
            onClick={() => {
              setAvailability("all");
              window.history.replaceState(null, "", "/shop");
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>
      )}
      <Drawer
        className="gallery-drawer filter-drawer"
        footer={
          <button
            className="filter-apply"
            onClick={() => setFiltersOpen(false)}
            type="button"
          >
            Show {visible ? "1 work" : "no works"}
          </button>
        }
        onOpenChange={setFiltersOpen}
        open={filtersOpen}
        side="bottom"
        title="Filter the collection"
      >
        {filters}
      </Drawer>
    </>
  );
}
