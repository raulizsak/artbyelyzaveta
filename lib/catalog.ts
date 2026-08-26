export type PaintingStatus =
  | "draft"
  | "available"
  | "reserved"
  | "sold"
  | "archived";

export type MediaKind = "room" | "detail" | "artwork";
export type MediaVariant = "thumbnail" | "card" | "main" | "large" | "original";

export type PaintingMedia = {
  id: string;
  src: string;
  thumbnailSrc: string;
  largeSrc: string;
  alt: string;
  width: number;
  height: number;
  kind: MediaKind;
  position: number;
};

export type Painting = {
  id: string;
  slug: string;
  title: string;
  description: string;
  story: string;
  priceCents: number;
  currency: string;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  medium: string | null;
  surface: string | null;
  category: string | null;
  orientation: "landscape" | "portrait" | "square" | "other" | null;
  framed: boolean;
  frameDescription: string | null;
  signed: boolean;
  readyToHang: boolean;
  certificate: boolean;
  status: PaintingStatus;
  featured: boolean;
  year: number | null;
  media: PaintingMedia[];
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
};

export type CartPainting = Pick<
  Painting,
  | "id"
  | "slug"
  | "title"
  | "priceCents"
  | "currency"
  | "medium"
  | "surface"
  | "widthCm"
  | "heightCm"
  | "depthCm"
  | "status"
> & { image: PaintingMedia };

export const toCartPainting = (painting: Painting): CartPainting => ({
  id: painting.id,
  slug: painting.slug,
  title: painting.title,
  priceCents: painting.priceCents,
  currency: painting.currency,
  medium: painting.medium,
  surface: painting.surface,
  widthCm: painting.widthCm,
  heightCm: painting.heightCm,
  depthCm: painting.depthCm,
  status: painting.status,
  image: painting.media[0],
});

export const formatMoney = (cents: number, currency = "AUD") =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);

const formatDimension = (value: number | null) =>
  value === null ? null : Number.isInteger(value) ? `${value}` : `${value}`;

export const paintingDimensions = (
  painting: Pick<Painting, "widthCm" | "heightCm" | "depthCm">,
) => {
  const dimensions = [
    formatDimension(painting.widthCm),
    formatDimension(painting.heightCm),
    formatDimension(painting.depthCm),
  ].filter(Boolean);
  return dimensions.length
    ? `${dimensions.join(" × ")} cm`
    : "Dimensions on request";
};

export const availabilityLabel = (status: PaintingStatus) => {
  switch (status) {
    case "available":
      return "Available · One of one";
    case "reserved":
      return "Currently reserved";
    case "sold":
      return "Sold";
    default:
      return "Not currently available";
  }
};
