import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { AddToCart } from "@/components/add-to-cart";
import { ProductGallery } from "@/components/product-gallery";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  availabilityLabel,
  formatMoney,
  paintingDimensions,
  toCartPainting,
} from "@/lib/catalog";
import { getPaintingBySlug } from "@/lib/catalog-data";
import { getPaymentMode } from "@/lib/env";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const painting = await getPaintingBySlug(slug);
  if (!painting) return {};
  return {
    title: painting.seoTitle ?? `${painting.title} — Original Painting`,
    description: painting.seoDescription ?? painting.description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const painting = await getPaintingBySlug(slug);
  if (!painting) notFound();
  const cartPainting = toCartPainting(painting);
  const paymentMode = getPaymentMode();
  return (
    <main id="main-content">
      <div className="product-breadcrumb shell">
        <Link href="/shop">Shop</Link>
        <ChevronRight aria-hidden="true" size={13} />
        <span>{painting.title}</span>
      </div>
      <section className="product-layout shell">
        <ProductGallery painting={painting} />
        <aside className="product-info">
          <p className="eyebrow">Original oil painting</p>
          <h1>{painting.title}</h1>
          <p className="product-info__price">
            {formatMoney(painting.priceCents, painting.currency)}
          </p>
          <span className="availability">
            <i /> {availabilityLabel(painting.status)}
          </span>
          <p className="product-info__description">{painting.description}</p>
          <dl className="spec-list">
            <div>
              <dt>Medium</dt>
              <dd>
                {painting.medium ?? "Original artwork"}
                {painting.surface
                  ? ` on ${painting.surface.toLowerCase()}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>{paintingDimensions(painting)}</dd>
            </div>
            <div>
              <dt>Framing</dt>
              <dd>
                {painting.frameDescription ??
                  (painting.framed ? "Framed" : "Unframed")}
              </dd>
            </div>
            <div>
              <dt>Hanging</dt>
              <dd>
                {painting.readyToHang
                  ? "Ready to hang"
                  : "Hanging arrangement required"}
              </dd>
            </div>
            <div>
              <dt>Authenticity</dt>
              <dd>
                {painting.certificate
                  ? "Certificate included"
                  : "Contact the artist"}
              </dd>
            </div>
          </dl>
          <div className="product-actions">
            <AddToCart painting={cartPainting} />
            <AddToCart buyNow painting={cartPainting} />
          </div>
          <p className="demo-note">
            <LockKeyhole aria-hidden="true" size={15} />
            {paymentMode === "live"
              ? "Secure payments processed by Stripe."
              : paymentMode === "test"
                ? "Stripe test mode. No real payment will be taken."
                : "Preview checkout. No payment will be taken."}
          </p>
          <div className="assurance-list">
            <span>
              <Truck /> Carefully packed
            </span>
            <span>
              <PackageCheck /> Shipping confirmed before purchase
            </span>
            <span>
              <ShieldCheck /> Australian Consumer Law respected
            </span>
          </div>
          <Accordion className="product-accordion" collapsible type="single">
            <AccordionItem value="story">
              <AccordionTrigger>About this painting</AccordionTrigger>
              <AccordionContent>
                <p>{painting.story}</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="delivery">
              <AccordionTrigger>Delivery & collection</AccordionTrigger>
              <AccordionContent>
                <p>
                  Shipping or Melbourne collection arrangements are confirmed
                  personally. Shipping is not silently estimated or added.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="care">
              <AccordionTrigger>Care & display</AccordionTrigger>
              <AccordionContent>
                <p>
                  Keep the work away from direct sunlight, moisture and heat.
                  Handle by the edges with clean, dry hands.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </aside>
      </section>
      <section className="product-story shell">
        <p className="eyebrow">The work</p>
        <blockquote>“A landscape made for slow looking.”</blockquote>
        <p>{painting.story}</p>
      </section>
    </main>
  );
}
