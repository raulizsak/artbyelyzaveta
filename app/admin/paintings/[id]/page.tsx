import { notFound } from "next/navigation";
import {
  PaintingEditor,
  type PaintingEditorMedia,
} from "@/components/painting-editor";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { paintingInputSchema } from "@/lib/painting-admin";
import { mediaPositionToken } from "@/lib/painting-media";
import { createAdminClient } from "@/lib/supabase/admin";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id;
  await requireAdminAal2(`/admin/paintings/${encodeURIComponent(id)}`);
  const { data } = await createAdminClient()
    .from("paintings")
    .select("*, painting_media(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const catalogueState = paintingInputSchema
    .pick({ orientation: true, status: true })
    .parse({ orientation: data.orientation, status: data.status });
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object/public/artwork-public/`;
  const mediaGroups = new Map<number, typeof data.painting_media>();
  for (const media of data.painting_media) {
    if (media.variant === "original") continue;
    mediaGroups.set(media.position, [
      ...(mediaGroups.get(media.position) ?? []),
      media,
    ]);
  }
  const initialMedia: PaintingEditorMedia[] = [...mediaGroups.entries()]
    .map(([position, variants]) => {
      const preview =
        variants.find((item) => item.variant === "card") ??
        variants.find((item) => item.variant === "main") ??
        variants[0];
      return {
        alt: preview.alt_text,
        groupKey: mediaPositionToken(position),
        kind: preview.kind as PaintingEditorMedia["kind"],
        position,
        src: `${storageBase}${preview.storage_path}`,
      };
    })
    .sort((a, b) => a.position - b.position);
  return (
    <PaintingEditor
      initialMedia={initialMedia}
      initial={{
        id: data.id,
        slug: data.slug,
        title: data.title,
        description: data.description,
        story: data.story,
        priceAud: (data.price_cents / 100).toFixed(2),
        shippingAud: (data.shipping_cents / 100).toFixed(2),
        currency: "AUD",
        widthCm: data.width_cm === null ? null : Number(data.width_cm),
        heightCm: data.height_cm === null ? null : Number(data.height_cm),
        depthCm: data.depth_cm === null ? null : Number(data.depth_cm),
        medium: data.medium,
        surface: data.surface,
        category: data.category,
        orientation: catalogueState.orientation,
        framed: data.framed,
        frameDescription: data.frame_description,
        signed: data.signed,
        readyToHang: data.ready_to_hang,
        certificate: data.certificate,
        status: catalogueState.status,
        featured: data.featured,
        year: data.year,
        seoTitle: data.seo_title,
        seoDescription: data.seo_description,
      }}
    />
  );
}
