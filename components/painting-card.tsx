import Link from "next/link";
import { ArtworkImage } from "@/components/artwork-image";
import { formatMoney, paintingDimensions, type Painting } from "@/lib/catalog";

export function PaintingCard({
  painting,
  eager = false,
}: {
  painting: Painting;
  eager?: boolean;
}) {
  const media = painting.media[0];
  return (
    <article className="painting-card">
      <Link
        aria-label={`View ${painting.title}`}
        className="painting-card__link"
        href={`/shop/${painting.slug}`}
      >
        <div className="painting-card__image">
          {media ? (
            <ArtworkImage eager={eager} media={media} />
          ) : (
            <span className="artwork-image-error">Photograph unavailable</span>
          )}
          <span className="status-pill">
            {painting.status === "reserved"
              ? "Reserved"
              : painting.status === "sold"
                ? "Sold"
                : "Available"}
          </span>
        </div>
        <div className="painting-card__content">
          <h2>{painting.title}</h2>
          <strong>
            {formatMoney(painting.priceCents, painting.currency)}{" "}
            <small>{painting.currency}</small>
          </strong>
        </div>
        <div className="painting-card__meta">
          <span>{paintingDimensions(painting)}</span>
          {painting.medium ? (
            <span>
              {painting.medium}
              {painting.surface ? ` on ${painting.surface.toLowerCase()}` : ""}
            </span>
          ) : null}
          {painting.framed && painting.frameDescription ? (
            <span>{painting.frameDescription}</span>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
