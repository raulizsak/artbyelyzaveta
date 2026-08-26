"use client";

import Image from "next/image";
import { Expand, Sofa } from "lucide-react";
import { useMemo, useState } from "react";
import BasicModal from "@/components/smoothui/basic-modal";
import type { Painting } from "@/lib/catalog";

export function ProductGallery({ painting }: { painting: Painting }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [roomPreview, setRoomPreview] = useState(false);
  const [roomIndex, setRoomIndex] = useState(0);
  const media = painting.media;
  const current = media[active];
  const rooms = useMemo(
    () => media.filter((item) => item.kind === "room"),
    [media],
  );
  const currentRoom = rooms[roomIndex] ?? null;

  return (
    <div className="product-gallery">
      <div className="product-gallery__main">
        <button
          aria-label="Open image full screen"
          onClick={() => setLightbox(true)}
          type="button"
        >
          <Image
            alt={current.alt}
            fetchPriority="high"
            height={current.height}
            loading="eager"
            sizes="(max-width: 900px) 100vw, 58vw"
            src={current.src}
            width={current.width}
          />
          <span>
            <Expand aria-hidden="true" size={16} /> View larger
          </span>
        </button>
      </div>
      <div aria-label="Painting views" className="product-gallery__thumbs">
        {media.map((image, index) => (
          <button
            aria-label={`Show view ${index + 1}`}
            aria-pressed={active === index}
            key={image.src}
            onClick={() => setActive(index)}
            type="button"
          >
            <Image alt="" height={110} src={image.thumbnailSrc} width={110} />
          </button>
        ))}
      </div>
      <button
        className="room-preview-button"
        onClick={() => setRoomPreview(true)}
        type="button"
      >
        <Sofa aria-hidden="true" size={18} /> Preview in a room
      </button>

      <BasicModal
        isOpen={lightbox}
        onClose={() => setLightbox(false)}
        size="full"
        title={`${painting.title} — view ${active + 1}`}
      >
        <div className="lightbox-image">
          <Image
            alt={current.alt}
            height={current.height}
            sizes="90vw"
            src={current.largeSrc}
            width={current.width}
          />
        </div>
      </BasicModal>

      <BasicModal
        isOpen={roomPreview}
        onClose={() => setRoomPreview(false)}
        size="full"
        title="See it in a room"
      >
        <p className="modal-intro">
          Choose a setting to understand the painting’s landscape proportions.
          Room images are an indicative preview.
        </p>
        {currentRoom ? (
          <div className="room-preview-single">
            <Image
              alt={currentRoom.alt}
              height={currentRoom.height}
              key={currentRoom.id}
              sizes="(max-width: 700px) 90vw, 70vw"
              src={currentRoom.largeSrc}
              width={currentRoom.width}
            />
            <div
              aria-label="Choose a room setting"
              className="room-preview-choices"
            >
              {rooms.map((image, index) => (
                <button
                  aria-pressed={index === roomIndex}
                  key={image.id}
                  onClick={() => setRoomIndex(index)}
                  type="button"
                >
                  Room {index + 1}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p>No room previews are available for this painting yet.</p>
        )}
      </BasicModal>
    </div>
  );
}
