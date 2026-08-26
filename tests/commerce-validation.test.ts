import { describe, expect, it } from "vitest";
import { checkoutSchema } from "../lib/checkout";
import { commissionSchema, contactSchema } from "../lib/enquiries";

const checkout = {
  paintingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  firstName: "Avery",
  lastName: "Collector",
  email: "AVERY@example.test",
  phone: "0400 000 000",
  delivery: "collection" as const,
  address: "",
  suburb: "",
  state: "",
  postcode: "",
  country: "Australia",
  notes: "",
};
describe("commerce boundary validation", () => {
  it("normalizes email and ignores a tampered browser total", () => {
    const result = checkoutSchema.parse({
      ...checkout,
      priceCents: 1,
      total: 1,
    });
    expect(result.email).toBe("avery@example.test");
    expect(result).not.toHaveProperty("priceCents");
    expect(result).not.toHaveProperty("total");
  });
  it("requires a complete shipping address only for shipping", () => {
    expect(checkoutSchema.safeParse(checkout).success).toBe(true);
    expect(
      checkoutSchema.safeParse({ ...checkout, delivery: "shipping" }).success,
    ).toBe(false);
  });
  it("rejects invalid enquiry consent and private upload metadata", () => {
    expect(
      contactSchema.safeParse({
        name: "A",
        email: "a@example.test",
        subject: "",
        message: "Hello",
        consent: false,
      }).success,
    ).toBe(false);
    expect(
      commissionSchema.safeParse({
        name: "A",
        email: "a@example.test",
        phone: "",
        subject: "",
        inspiration: "Landscape",
        dimensions: "",
        budget: "",
        timing: "",
        notes: "",
        consent: true,
        inspirationFiles: [
          {
            path: "other/place.jpg",
            fileName: "place.jpg",
            contentType: "image/jpeg",
            size: 100,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
