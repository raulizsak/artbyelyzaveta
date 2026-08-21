import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  COWS_AT_DUSK,
  formatMoney,
  paintingDimensions,
  type Painting,
} from "@/lib/catalog";

export function PaintingCard({
  painting = COWS_AT_DUSK,
}: {
  painting?: Painting;
}) {
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
        <span className="status-pill">Available</span>
      </Link>
      <div className="painting-card__content">
        <div>
          <p>{painting.category} · Original</p>
          <h2>
            <Link href={`/shop/${painting.slug}`}>{painting.title}</Link>
          </h2>
        </div>
        <ArrowUpRight aria-hidden="true" size={22} strokeWidth={1.4} />
      </div>
      <div className="painting-card__meta">
        <span>{paintingDimensions(painting)} · Oil on canvas</span>
        <strong>{formatMoney(painting.price)}</strong>
      </div>
    </article>
  );
}
