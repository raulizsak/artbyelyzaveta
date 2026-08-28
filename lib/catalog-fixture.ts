import type { Painting } from "@/lib/catalog";

// Safe build/test fallback only. Production catalogue reads from Supabase.
export const LOCAL_CATALOGUE_FIXTURE: Painting[] = [
  {
    id: "5f9f2b5d-2bf0-4f16-a63f-45ac2df82f77",
    slug: "cows-at-dusk",
    title: "Cows at Dusk",
    description:
      "An original oil landscape on canvas, bringing together rolling green country, grazing cattle and the gentle light of dusk.",
    story:
      "A quiet rural scene unfolds beneath an expressive evening sky. The winding track, long shadows and distant fields lead the eye through a landscape made for slow looking.",
    priceCents: 137000,
    shippingCents: 0,
    currency: "AUD",
    widthCm: 90,
    heightCm: 60,
    depthCm: 1,
    medium: "Oil",
    surface: "Canvas",
    category: "Expressionism",
    orientation: "landscape",
    framed: false,
    frameDescription: "Unframed",
    signed: true,
    readyToHang: true,
    certificate: true,
    status: "available",
    featured: true,
    year: null,
    seoTitle: "Cows at Dusk — Original Oil Painting | Art by Elyzaveta",
    seoDescription:
      "Cows at Dusk, an original 90 × 60 cm oil painting on canvas by Elyzaveta Izsak. Ready to hang and supplied with a certificate of authenticity.",
    createdAt: "2026-01-01T00:00:00.000Z",
    media: [
      [
        "cows-at-dusk-gallery-wall",
        "artwork",
        1080,
        1080,
        "Cows at Dusk displayed in a simple timber frame on a softly lit wall",
      ],
      [
        "cows-at-dusk-warm-room",
        "room",
        1122,
        1402,
        "Cows at Dusk displayed above a console in a warm neutral living room",
      ],
      [
        "cows-at-dusk-classic-room",
        "room",
        1122,
        1402,
        "Cows at Dusk displayed in a classical cream living room",
      ],
      [
        "cows-at-dusk-console-room",
        "room",
        1080,
        1080,
        "Cows at Dusk displayed above a minimalist console",
      ],
      [
        "cows-at-dusk-modern-room",
        "room",
        1080,
        1080,
        "Cows at Dusk displayed in a modern dining space",
      ],
    ].map(([name, kind, width, height, alt], position) => ({
      id: `fixture-${position}`,
      src: `/optimized/artwork/${name}-main.webp`,
      thumbnailSrc: `/optimized/artwork/${name}-thumbnail.webp`,
      largeSrc: `/optimized/artwork/${name}-large.webp`,
      alt: String(alt),
      width: Number(width),
      height: Number(height),
      kind: kind as "artwork" | "room",
      position,
    })),
  },
];
