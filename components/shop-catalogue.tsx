"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import Drawer from "@/components/smoothui/drawer";
import { PaintingCard } from "@/components/painting-card";
import SmoothButton from "@/components/ui/smoothui/smooth-button";
import type { Painting } from "@/lib/catalog";
import {
  CATALOGUE_PAGE_SIZE,
  catalogueFilters,
  filterPaintings,
} from "@/lib/catalogue-filters";

export function ShopCatalogue({ paintings }: { paintings: Painting[] }) {
  const params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = catalogueFilters(params);
  const searchId = useId();
  const [searchDraft, setSearchDraft] = useState({
    query: filters.query,
    value: filters.query,
  });
  if (searchDraft.query !== filters.query)
    setSearchDraft({ query: filters.query, value: filters.query });
  const visible = useMemo(
    () =>
      filterPaintings(
        paintings,
        catalogueFilters(new URLSearchParams(params.toString())),
      ),
    [paintings, params],
  );
  const displayed = visible.slice(0, filters.page * CATALOGUE_PAGE_SIZE);
  const hasFilters =
    filters.availability !== "all" ||
    filters.orientation !== "all" ||
    Boolean(filters.query);

  function update(key: string, value: string) {
    // Next.js synchronizes native history with useSearchParams. Filtering the
    // already loaded catalogue needs no network request or full-page skeleton.
    const next = new URLSearchParams(window.location.search);
    if (!value || value === "all" || (key === "sort" && value === "featured"))
      next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    window.history.pushState(null, "", `/shop${next.size ? `?${next}` : ""}`);
  }

  const filterFields = (
    <div className="filter-fields">
      <label>
        Availability
        <select
          onChange={(e) => update("availability", e.target.value)}
          value={filters.availability}
        >
          <option value="all">All works</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
        </select>
      </label>
      <label>
        Sort by
        <select
          onChange={(e) => update("sort", e.target.value)}
          value={filters.sort}
        >
          <option value="featured">Featured</option>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </label>
      <label>
        Orientation
        <select
          onChange={(e) => update("orientation", e.target.value)}
          value={filters.orientation}
        >
          <option value="all">All orientations</option>
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
          <option value="square">Square</option>
          <option value="other">Other</option>
        </select>
      </label>
    </div>
  );

  return (
    <>
      <div className="catalogue-toolbar">
        <form
          className="catalogue-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            update(
              "q",
              String(new FormData(event.currentTarget).get("q") ?? "").trim(),
            );
          }}
        >
          <Search aria-hidden="true" size={17} />
          <label className="sr-only" htmlFor={searchId}>
            Search artworks
          </label>
          <input
            value={
              searchDraft.query === filters.query
                ? searchDraft.value
                : filters.query
            }
            onChange={(event) =>
              setSearchDraft({
                query: filters.query,
                value: event.target.value,
              })
            }
            id={searchId}
            maxLength={200}
            name="q"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                update("q", event.currentTarget.value.trim());
              }
            }}
            placeholder="Search artworks"
            type="search"
          />
          <button
            aria-label="Search collection"
            className="text-button"
            type="submit"
          >
            Search
          </button>
        </form>
        <div className="desktop-filters">{filterFields}</div>
        <button
          className="filter-button"
          onClick={() => setFiltersOpen(true)}
          type="button"
        >
          <SlidersHorizontal aria-hidden="true" size={17} /> Filters
        </button>
      </div>
      <div className="catalogue-results">
        <p aria-live="polite" role="status">
          {visible.length} original{visible.length === 1 ? "" : "s"}
          {filters.query ? ` matching “${filters.query}”` : ""}
        </p>
        {hasFilters ? (
          <button
            className="text-button"
            onClick={() => window.history.pushState(null, "", "/shop")}
            type="button"
          >
            Clear filters <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      {visible.length ? (
        <>
          <div className="catalogue-grid">
            {displayed.map((painting, index) => (
              <PaintingCard
                eager={index < 4}
                key={painting.id}
                painting={painting}
              />
            ))}
          </div>
          {displayed.length < visible.length ? (
            <div className="catalogue-pagination">
              <p>
                Showing {displayed.length} of {visible.length} originals
              </p>
              <SmoothButton
                className="cta cta--secondary"
                onClick={() => update("page", String(filters.page + 1))}
                variant="outline"
              >
                Show more artworks
              </SmoothButton>
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state catalogue-empty">
          <h2>No works found</h2>
          <p>Try another search or clear the filters to see the collection.</p>
          <button
            className="text-button"
            onClick={() => window.history.pushState(null, "", "/shop")}
            type="button"
          >
            Clear filters
          </button>
        </div>
      )}
      <Drawer
        className="gallery-drawer filter-drawer"
        description="Filter by availability and artwork orientation, or change the display order."
        footer={
          <SmoothButton
            className="filter-apply"
            onClick={() => setFiltersOpen(false)}
          >
            Show {visible.length} work{visible.length === 1 ? "" : "s"}
          </SmoothButton>
        }
        onOpenChange={setFiltersOpen}
        open={filtersOpen}
        side="bottom"
        title="Filter the collection"
      >
        {filterFields}
      </Drawer>
    </>
  );
}
