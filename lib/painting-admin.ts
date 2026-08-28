import { z } from "zod";

const audAmount = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), {
    message: "Enter an AUD amount with no more than two decimal places.",
  })
  .transform((value) => Math.round(Number(value) * 100));

export const paintingInputSchema = z.object({
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
  currency: z.string().regex(/^[A-Z]{3}$/),
  widthCm: z.number().positive().nullable(),
  heightCm: z.number().positive().nullable(),
  depthCm: z.number().positive().nullable(),
  medium: z.string().trim().max(160).nullable(),
  surface: z.string().trim().max(160).nullable(),
  category: z.string().trim().max(160).nullable(),
  orientation: z.enum(["portrait", "landscape", "square", "other"]).nullable(),
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
});
