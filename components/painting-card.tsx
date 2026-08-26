import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  availabilityLabel,
  formatMoney,
  paintingDimensions,
  type Painting,
} from "@/lib/catalog";

export function PaintingCard({ painting }: { painting: Painting }) {
  return (
    <article className="painting-card">
      <Link
        aria-label={`View ${painting.title}`}
        className="painting-card__image"
        href={`/shop/${painting.slug}`}
      >
        <Image
          alt={painting.media[0].alt}
          height={1080}
          sizes="(max-width: 700px) 92vw, 55vw"
          src={painting.media[0].src}
          width={1080}
        />
        <span className="status-pill">
          {availabilityLabel(painting.status)}
        </span>
      </Link>
      <div className="painting-card__content">
        <div>
          <p>{painting.category ?? "Original"} · Original</p>
          <h2>
            <Link href={`/shop/${painting.slug}`}>{painting.title}</Link>
          </h2>
        </div>
        <ArrowUpRight aria-hidden="true" size={22} strokeWidth={1.4} />
      </div>
      <div className="painting-card__meta">
        <span>
          {paintingDimensions(painting)} ·{" "}
          {painting.medium ?? "Original artwork"}
          {painting.surface ? ` on ${painting.surface.toLowerCase()}` : ""}
        </span>
        <strong>{formatMoney(painting.priceCents, painting.currency)}</strong>
      </div>
    </article>
  );
}
