import { notFound } from "next/navigation";
import { PaintingEditor } from "@/components/painting-editor";
import { requireAdminAal2 } from "@/lib/auth/authorization";
import { paintingInputSchema } from "@/lib/painting-admin";
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
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const catalogueState = paintingInputSchema
    .pick({ orientation: true, status: true })
    .parse({ orientation: data.orientation, status: data.status });
  return (
    <PaintingEditor
      initial={{
        id: data.id,
        slug: data.slug,
        title: data.title,
        description: data.description,
        story: data.story,
        priceCents: data.price_cents,
        currency: data.currency,
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
