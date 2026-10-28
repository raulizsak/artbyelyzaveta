import { describe, expect, it } from "vitest";
import { LOCAL_CATALOGUE_FIXTURE } from "../lib/catalog-fixture";
import {
  catalogueFilters,
  filterPaintings,
  paintingOrientation,
} from "../lib/catalogue-filters";
import type { Painting } from "../lib/catalog";

const works = [
  {
    ...LOCAL_CATALOGUE_FIXTURE[0],
    id: "a",
    title: "Evening",
    priceCents: 50000,
  },
  {
    ...LOCAL_CATALOGUE_FIXTURE[0],
    id: "b",
    title: "Portrait",
    widthCm: 40,
    heightCm: 60,
    status: "sold",
    priceCents: 90000,
  },
  {
    ...LOCAL_CATALOGUE_FIXTURE[0],
    id: "c",
    title: "Square",
    widthCm: 60,
    heightCm: 60,
    priceCents: 70000,
  },
  { ...LOCAL_CATALOGUE_FIXTURE[0], id: "d", title: "Private", status: "draft" },
] as Painting[];
const select = (query = "") =>
  filterPaintings(works, catalogueFilters(new URLSearchParams(query)));
describe("catalogue filters", () => {
  it("derives painting orientation from dimensions rather than room photography", () => {
    expect(paintingOrientation(works[1])).toBe("portrait");
    expect(
      paintingOrientation({
        widthCm: null,
        heightCm: null,
        orientation: "landscape",
      }),
    ).toBe("landscape");
    expect(select("orientation=landscape").map((work) => work.id)).toEqual([
      "a",
    ]);
  });
  it("combines search, availability and orientation", () => {
    expect(
      select("orientation=portrait&availability=sold&q=PORTRAIT").map(
        (work) => work.id,
      ),
    ).toEqual(["b"]);
    expect(select("orientation=portrait&availability=available")).toEqual([]);
    expect(select("q=does-not-exist")).toEqual([]);
  });
  it("never includes draft records even in an admin's catalogue response", () =>
    expect(select()).toHaveLength(3));
  it("sorts authoritative prices in both directions without mutating records", () => {
    expect(select("sort=price-asc").map((work) => work.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
    expect(select("sort=price-desc").map((work) => work.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(works[0].id).toBe("a");
  });
  it("normalizes invalid URL values and bounds progressive loading", () => {
    expect(
      catalogueFilters(
        new URLSearchParams(
          "page=-1&orientation=fake&sort=fake&availability=draft",
        ),
      ),
    ).toMatchObject({
      page: 1,
      orientation: "all",
      sort: "featured",
      availability: "all",
    });
    expect(catalogueFilters(new URLSearchParams("page=999999")).page).toBe(
      1000,
    );
  });
});
