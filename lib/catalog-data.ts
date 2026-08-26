import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { LOCAL_CATALOGUE_FIXTURE } from "@/lib/catalog-fixture";
import type {
  MediaKind,
  MediaVariant,
  Painting,
  PaintingMedia,
  PaintingStatus,
} from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

type PaintingRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  story: string;
  price_cents: number;
  currency: string;
  width_cm: number | string | null;
  height_cm: number | string | null;
  depth_cm: number | string | null;
  medium: string | null;
  surface: string | null;
  category: string | null;
  orientation: Painting["orientation"];
  framed: boolean;
  frame_description: string | null;
  signed: boolean;
  ready_to_hang: boolean;
  certificate: boolean;
  status: PaintingStatus;
  featured: boolean;
  year: number | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  painting_media: MediaRow[] | null;
};

type MediaRow = {
  id: string;
  kind: MediaKind;
  storage_path: string;
  variant: MediaVariant;
  width: number;
  height: number;
  alt_text: string;
  position: number;
};

const toNumber = (value: number | string | null) =>
  value === null ? null : Number(value);

const publicStorageUrl = (path: string) => {
  if (path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return base
    ? `${base}/storage/v1/object/public/artwork-public/${path}`
    : path;
};

const groupMedia = (rows: MediaRow[] | null): PaintingMedia[] => {
  const grouped = new Map<string, MediaRow[]>();
  for (const row of rows ?? []) {
    if (row.variant === "original") continue;
    const key = `${row.kind}:${row.position}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return [...grouped.values()]
    .sort((a, b) => a[0].position - b[0].position)
    .map((variants) => {
      const byVariant = new Map(variants.map((row) => [row.variant, row]));
      const main =
        byVariant.get("main") ??
        byVariant.get("card") ??
        byVariant.get("large") ??
        byVariant.get("thumbnail") ??
        variants[0];
      const thumbnail = byVariant.get("thumbnail") ?? main;
      const large = byVariant.get("large") ?? main;
      return {
        id: main.id,
        src: publicStorageUrl(main.storage_path),
        thumbnailSrc: publicStorageUrl(thumbnail.storage_path),
        largeSrc: publicStorageUrl(large.storage_path),
        alt: main.alt_text,
        width: main.width,
        height: main.height,
        kind: main.kind,
        position: main.position,
      };
    });
};

const mapPainting = (row: PaintingRow): Painting => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  story: row.story,
  priceCents: row.price_cents,
  currency: row.currency,
  widthCm: toNumber(row.width_cm),
  heightCm: toNumber(row.height_cm),
  depthCm: toNumber(row.depth_cm),
  medium: row.medium,
  surface: row.surface,
  category: row.category,
  orientation: row.orientation,
  framed: row.framed,
  frameDescription: row.frame_description,
  signed: row.signed,
  readyToHang: row.ready_to_hang,
  certificate: row.certificate,
  status: row.status,
  featured: row.featured,
  year: row.year,
  media: groupMedia(row.painting_media),
  seoTitle: row.seo_title,
  seoDescription: row.seo_description,
  createdAt: row.created_at,
});

export async function getPaintings(): Promise<Painting[]> {
  noStore();
  if (!isSupabaseConfigured()) return LOCAL_CATALOGUE_FIXTURE;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paintings")
    .select("*, painting_media(*)")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to load paintings: ${error.message}`);
  return (data as PaintingRow[])
    .map(mapPainting)
    .filter((item) => item.media.length);
}

export async function getPaintingBySlug(slug: string) {
  const paintings = await getPaintings();
  return paintings.find((painting) => painting.slug === slug) ?? null;
}

export async function getFeaturedPainting() {
  const paintings = await getPaintings();
  return (
    paintings.find((painting) => painting.featured) ?? paintings[0] ?? null
  );
}
