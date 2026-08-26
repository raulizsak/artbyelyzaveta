"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Drawer from "@/components/smoothui/drawer";
import { PaintingCard } from "@/components/painting-card";
import type { Painting } from "@/lib/catalog";

export function ShopCatalogue({ paintings }: { paintings: Painting[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [availability, setAvailability] = useState("all");
  const [sort, setSort] = useState("featured");
  const query = (params.get("q") ?? "").toLowerCase();
  const visible = useMemo(() => {
    const filtered = paintings.filter((painting) => {
      if (availability !== "all" && painting.status !== availability)
        return false;
      return (
        !query ||
        `${painting.title} ${painting.category ?? ""} ${painting.medium ?? ""} ${painting.description}`
          .toLowerCase()
          .includes(query)
      );
    });
    return [...filtered].sort((a, b) => {
      if (sort === "price-asc") return a.priceCents - b.priceCents;
      if (sort === "price-desc") return b.priceCents - a.priceCents;
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      return Number(b.featured) - Number(a.featured);
    });
  }, [availability, paintings, query, sort]);

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
          {visible.length
            ? `${visible.length} original${visible.length === 1 ? "" : "s"}`
            : "No originals"}
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
      {visible.length ? (
        <div className="catalogue-grid">
          {visible.map((painting) => (
            <PaintingCard key={painting.id} painting={painting} />
          ))}
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
            Show{" "}
            {visible.length
              ? `${visible.length} work${visible.length === 1 ? "" : "s"}`
              : "no works"}
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
