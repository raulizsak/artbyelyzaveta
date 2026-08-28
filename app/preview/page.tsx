import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand-logo";
import { PreviewAccessForm } from "@/components/preview-access-form";
import { safePreviewNext } from "@/lib/preview";

export const metadata: Metadata = { title: "Private preview" };

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safePreviewNext((await searchParams).next);
  return (
    <main className="preview-gate" id="main-content">
      <section className="preview-gate__card">
        <BrandLogo className="preview-gate__logo" />
        <p className="eyebrow">Private preview</p>
        <h1>This art shop is currently in preview.</h1>
        <p>
          Enter the private preview password to explore the collection and
          customer experience.
        </p>
        <PreviewAccessForm next={next} />
        <small>Melbourne, Australia</small>
      </section>
    </main>
  );
}
