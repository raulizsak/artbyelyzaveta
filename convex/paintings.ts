import { v } from "convex/values";
import { query } from "./_generated/server";

const media = v.object({
  src: v.string(),
  alt: v.string(),
  width: v.number(),
  height: v.number(),
  kind: v.union(v.literal("room"), v.literal("detail"), v.literal("artwork")),
});
const painting = v.object({
  _id: v.id("paintings"),
  _creationTime: v.number(),
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
  media: v.array(media),
  seoTitle: v.string(),
  seoDescription: v.string(),
});

export const listPublished = query({
  args: {},
  returns: v.array(painting),
  handler: async (ctx) =>
    await ctx.db
      .query("paintings")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .take(50),
});
export const bySlug = query({
  args: { slug: v.string() },
  returns: v.union(painting, v.null()),
  handler: async (ctx, args) =>
    await ctx.db
      .query("paintings")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique(),
});
