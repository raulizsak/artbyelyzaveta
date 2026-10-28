import { z } from "zod";

const audAmount = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), {
    message: "Enter an AUD amount with no more than two decimal places.",
  })
  .transform((value) => Math.round(Number(value) * 100))
  .pipe(z.number().int().min(0).max(2147483647));

export const paintingInputSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(180),
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(5000),
    story: z.string().trim().max(10000),
    priceAud: audAmount,
    shippingAud: audAmount,
    currency: z.literal("AUD"),
    widthCm: z.number().positive().nullable(),
    heightCm: z.number().positive().nullable(),
    depthCm: z.number().positive().nullable(),
    medium: z.string().trim().max(160).nullable(),
    surface: z.string().trim().max(160).nullable(),
    category: z.string().trim().max(160).nullable(),
    orientation: z
      .enum(["portrait", "landscape", "square", "other"])
      .nullable(),
    framed: z.boolean(),
    frameDescription: z.string().trim().max(500).nullable(),
    signed: z.boolean(),
    readyToHang: z.boolean(),
    certificate: z.boolean(),
    status: z.enum(["draft", "available", "reserved", "sold", "archived"]),
    featured: z.boolean(),
    year: z.number().int().min(1900).max(2200).nullable(),
    seoTitle: z.string().trim().max(180).nullable(),
    seoDescription: z.string().trim().max(500).nullable(),
  })
  .superRefine((value, context) => {
    if (value.status === "available") {
      if (value.priceAud <= 0)
        context.addIssue({
          code: "custom",
          path: ["priceAud"],
          message: "Published artwork needs a positive AUD price.",
        });
      for (const field of ["widthCm", "heightCm", "medium"] as const) {
        if (!value[field])
          context.addIssue({
            code: "custom",
            path: [field],
            message: "Required before publishing.",
          });
      }
    }
    if (
      value.widthCm &&
      value.heightCm &&
      value.orientation &&
      value.orientation !== "other"
    ) {
      const actual =
        value.widthCm === value.heightCm
          ? "square"
          : value.widthCm > value.heightCm
            ? "landscape"
            : "portrait";
      if (value.orientation !== actual)
        context.addIssue({
          code: "custom",
          path: ["orientation"],
          message: "Orientation must match the painting dimensions.",
        });
    }
  });
export const paintingCatalogueStateSchema = z.object({
  orientation: paintingInputSchema.shape.orientation,
  status: paintingInputSchema.shape.status,
});
