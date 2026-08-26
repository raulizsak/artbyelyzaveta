import { z } from "zod";

const shortText = (max: number) => z.string().trim().max(max);
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z
    .email()
    .trim()
    .max(320)
    .transform((value) => value.toLowerCase()),
  subject: shortText(200).transform((value) => value || "General enquiry"),
  message: z.string().trim().min(1).max(5000),
  consent: z.literal(true),
});

export const inspirationFileSchema = z.object({
  path: z
    .string()
    .regex(/^pending\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z
    .number()
    .int()
    .min(1)
    .max(8 * 1024 * 1024),
});

export const commissionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z
    .email()
    .trim()
    .max(320)
    .transform((value) => value.toLowerCase()),
  phone: shortText(50).nullable().optional(),
  subject: shortText(200).transform((value) => value || "Commission enquiry"),
  inspiration: z.string().trim().min(1).max(5000),
  dimensions: shortText(120).nullable().optional(),
  budget: shortText(120).nullable().optional(),
  timing: shortText(120).nullable().optional(),
  notes: shortText(5000).nullable().optional(),
  consent: z.literal(true),
  inspirationFiles: z.array(inspirationFileSchema).max(3),
});

export const uploadRequestSchema = z.object({
  files: z.array(inspirationFileSchema.omit({ path: true })).max(3),
});
