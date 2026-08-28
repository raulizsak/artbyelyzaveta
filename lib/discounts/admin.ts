import { z } from "zod";

const optionalPositiveInteger = z
  .union([z.number(), z.null()])
  .refine((value) => value === null || (Number.isInteger(value) && value > 0));

const optionalAudAmount = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => (value === null ? null : String(value).trim()))
  .refine(
    (value) => value === null || /^\d+(?:\.\d{1,2})?$/.test(value),
    "Enter an AUD amount with no more than two decimal places.",
  )
  .transform((value) => (value === null ? null : Math.round(Number(value) * 100)));

export const discountInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/),
    discountType: z.enum(["percentage", "fixed_amount"]),
    percentOff: z.number().positive().max(100).nullable(),
    amountOffAud: optionalAudAmount,
    appliesTo: z.enum(["all", "specific"]),
    paintingIds: z.array(z.uuid()).max(500),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable(),
    maxRedemptions: optionalPositiveInteger,
    oneUsePerCustomer: z.boolean(),
    minimumSubtotalAud: optionalAudAmount,
    combinable: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.discountType === "percentage" && value.percentOff === null)
      context.addIssue({
        code: "custom",
        message: "Enter a percentage.",
        path: ["percentOff"],
      });
    if (value.discountType === "fixed_amount" && !value.amountOffAud)
      context.addIssue({
        code: "custom",
        message: "Enter a fixed discount amount.",
        path: ["amountOffAud"],
      });
    if (value.appliesTo === "specific" && value.paintingIds.length === 0)
      context.addIssue({
        code: "custom",
        message: "Choose at least one painting.",
        path: ["paintingIds"],
      });
    if (value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt))
      context.addIssue({
        code: "custom",
        message: "The end must be after the start.",
        path: ["endsAt"],
      });
  });

export type DiscountInput = z.input<typeof discountInputSchema>;
export type ParsedDiscountInput = z.output<typeof discountInputSchema>;
