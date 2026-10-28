"use client";

import Image from "next/image";
import { useState } from "react";
import type { PaintingMedia } from "@/lib/catalog";

export function ArtworkImage({
  media,
  eager,
}: {
  media: PaintingMedia;
  eager: boolean;
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const widthAt = (max: number) =>
    Math.max(
      1,
      Math.round(
        media.width * Math.min(1, max / Math.max(media.width, media.height)),
      ),
    );
  return (
    <>
      {state === "loading" ? (
        <div
          aria-hidden="true"
          className="artwork-image-placeholder skeleton-block"
        />
      ) : null}
      {state === "error" ? (
        <span className="artwork-image-error">
          Photograph unavailable. Open artwork for details.
        </span>
      ) : (
        <picture>
          {media.cardSrc ? (
            <source
              sizes="(min-width: 1440px) 23vw, (min-width: 1024px) 30vw, (min-width: 390px) 45vw, 92vw"
              srcSet={`${media.thumbnailSrc} ${media.thumbnailWidth ?? widthAt(320)}w, ${media.cardSrc} ${media.cardWidth ?? widthAt(900)}w`}
            />
          ) : null}
          <Image
            alt={media.alt}
            className={state === "loaded" ? "artwork-image-loaded" : undefined}
            height={media.height}
            fetchPriority={eager ? "high" : undefined}
            loading={eager ? "eager" : "lazy"}
            onError={() => setState("error")}
            onLoad={() => setState("loaded")}
            src={media.cardSrc ?? media.src}
            width={media.width}
          />
        </picture>
      )}
    </>
  );
}
