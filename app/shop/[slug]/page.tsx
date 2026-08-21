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
import { COWS_AT_DUSK, formatMoney, paintingDimensions } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug !== COWS_AT_DUSK.slug) return {};
  return {
    title: "Cows at Dusk — Original Oil Painting",
    description: COWS_AT_DUSK.seoDescription,
  };
}
export function generateStaticParams() {
  return [{ slug: COWS_AT_DUSK.slug }];
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  if (slug !== COWS_AT_DUSK.slug) notFound();
  const painting = COWS_AT_DUSK;
  return (
    <main id="main-content">
      <div className="product-breadcrumb shell">
        <Link href="/shop">Shop</Link>
        <ChevronRight aria-hidden="true" size={13} />
        <span>{painting.title}</span>
      </div>
      <section className="product-layout shell">
        <ProductGallery />
        <aside className="product-info">
          <p className="eyebrow">Original oil painting</p>
          <h1>{painting.title}</h1>
          <p className="product-info__price">{formatMoney(painting.price)}</p>
          <span className="availability">
            <i /> Available · One of one
          </span>
          <p className="product-info__description">{painting.description}</p>
          <dl className="spec-list">
            <div>
              <dt>Medium</dt>
              <dd>
                {painting.medium} on {painting.surface.toLowerCase()}
              </dd>
            </div>
            <div>
              <dt>Dimensions</dt>
              <dd>{paintingDimensions(painting)}</dd>
            </div>
            <div>
              <dt>Framing</dt>
              <dd>{painting.frameDescription}</dd>
            </div>
            <div>
              <dt>Hanging</dt>
              <dd>Ready to hang</dd>
            </div>
            <div>
              <dt>Authenticity</dt>
              <dd>Certificate included</dd>
            </div>
          </dl>
          <div className="product-actions">
            <AddToCart />
            <AddToCart buyNow />
          </div>
          <p className="demo-note">
            <LockKeyhole aria-hidden="true" size={15} /> Demo checkout only — no
            payment details are requested or processed.
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
                  with you before any real purchase. See the shipping policy for
                  details.
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
