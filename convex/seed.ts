import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const seedPainting = mutation({
  args: {},
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("paintings")
      .withIndex("by_slug", (q) => q.eq("slug", "cows-at-dusk"))
      .unique();
    if (existing) return { created: false };
    await ctx.db.insert("paintings", {
      slug: "cows-at-dusk",
      title: "Cows at Dusk",
      description:
        "An original oil landscape on canvas, bringing together rolling green country, grazing cattle and the gentle light of dusk.",
      story:
        "A quiet rural scene unfolds beneath an expressive evening sky. The winding track, long shadows and distant fields lead the eye through a landscape made for slow looking.",
      price: 137000,
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
      signed: null,
      readyToHang: true,
      certificate: true,
      status: "available",
      featured: true,
      year: null,
      media: [
        {
          src: "/artwork/cows-at-dusk-gallery-wall.png",
          alt: "Cows at Dusk displayed in a simple timber frame on a softly lit wall",
          width: 1080,
          height: 1080,
          kind: "artwork",
        },
        {
          src: "/artwork/cows-at-dusk-warm-room.png",
          alt: "Cows at Dusk displayed above a console in a warm neutral living room",
          width: 1122,
          height: 1402,
          kind: "room",
        },
        {
          src: "/artwork/cows-at-dusk-classic-room.png",
          alt: "Cows at Dusk displayed in a classical cream living room",
          width: 1122,
          height: 1402,
          kind: "room",
        },
        {
          src: "/artwork/cows-at-dusk-console-room.png",
          alt: "Cows at Dusk displayed above a minimalist console",
          width: 1080,
          height: 1080,
          kind: "room",
        },
        {
          src: "/artwork/cows-at-dusk-modern-room.png",
          alt: "Cows at Dusk displayed in a modern dining space",
          width: 1080,
          height: 1080,
          kind: "room",
        },
      ],
      seoTitle: "Cows at Dusk — Original Oil Painting | Art by Elyzaveta",
      seoDescription:
        "Cows at Dusk, an original 90 × 60 cm oil painting on canvas by Elyzaveta Izsak. Ready to hang and supplied with a certificate of authenticity.",
    });
    return { created: true };
  },
});
