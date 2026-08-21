import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  paintings: defineTable({
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    story: v.string(),
    price: v.number(),
    currency: v.string(),
    widthCm: v.number(),
    heightCm: v.number(),
    depthCm: v.number(),
    medium: v.string(),
    surface: v.string(),
    category: v.string(),
    orientation: v.union(
      v.literal("landscape"),
      v.literal("portrait"),
      v.literal("square"),
    ),
    framed: v.boolean(),
    frameDescription: v.string(),
    signed: v.union(v.boolean(), v.null()),
    readyToHang: v.boolean(),
    certificate: v.boolean(),
    status: v.union(
      v.literal("draft"),
      v.literal("available"),
      v.literal("reserved"),
      v.literal("sold"),
    ),
    featured: v.boolean(),
    year: v.union(v.number(), v.null()),
    media: v.array(
      v.object({
        src: v.string(),
        alt: v.string(),
        width: v.number(),
        height: v.number(),
        kind: v.union(
          v.literal("room"),
          v.literal("detail"),
          v.literal("artwork"),
        ),
      }),
    ),
    seoTitle: v.string(),
    seoDescription: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_featured", ["featured"]),
  contactEnquiries: defineTable({
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    consent: v.boolean(),
    createdAt: v.number(),
    status: v.literal("new"),
  }).index("by_created_at", ["createdAt"]),
  commissionEnquiries: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    subject: v.string(),
    inspiration: v.string(),
    dimensions: v.string(),
    budget: v.string(),
    timing: v.string(),
    notes: v.string(),
    inspirationFiles: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          fileName: v.string(),
          contentType: v.union(
            v.literal("image/jpeg"),
            v.literal("image/png"),
            v.literal("image/webp"),
          ),
          size: v.number(),
        }),
      ),
    ),
    consent: v.boolean(),
    createdAt: v.number(),
    status: v.literal("new"),
  }).index("by_created_at", ["createdAt"]),
});
