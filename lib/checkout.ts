import { z } from "zod";

export const checkoutSchema = z
  .object({
    paintingIds: z.array(z.uuid()).min(1).max(10),
    discountCodes: z
      .array(z.string().trim().min(1).max(40))
      .max(5)
      .default([]),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z
      .email()
      .trim()
      .max(320)
      .transform((value) => value.toLowerCase()),
    phone: z.string().trim().min(1).max(50),
    delivery: z.enum(["shipping", "collection"]),
    address: z.string().trim().max(200),
    suburb: z.string().trim().max(120),
    state: z.string().trim().max(120),
    postcode: z.string().trim().max(20),
    country: z.string().trim().max(100),
    notes: z.string().trim().max(2000),
  })
  .superRefine((value, context) => {
    if (value.delivery === "shipping") {
      for (const field of [
        "address",
        "suburb",
        "state",
        "postcode",
        "country",
      ] as const) {
        if (!value[field])
          context.addIssue({
            code: "custom",
            path: [field],
            message: "Required for shipping",
          });
      }
    }
  });
