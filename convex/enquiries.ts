import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type AllowedImageType = "image/jpeg" | "image/png" | "image/webp";
type StoredInspirationFile = {
  storageId: Id<"_storage">;
  fileName: string;
  contentType: AllowedImageType;
  size: number;
};

const clean = (value: string, max: number) => value.trim().slice(0, max);
const validEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const inspirationFileValidator = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  contentType: v.union(
    v.literal("image/jpeg"),
    v.literal("image/png"),
    v.literal("image/webp"),
  ),
  size: v.number(),
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const submitContact = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
    consent: v.boolean(),
  },
  returns: v.id("contactEnquiries"),
  handler: async (ctx, args) => {
    if (
      !clean(args.name, 100) ||
      !validEmail(args.email) ||
      !clean(args.message, 4000) ||
      !args.consent
    )
      throw new Error("Please complete all required fields.");
    return await ctx.db.insert("contactEnquiries", {
      name: clean(args.name, 100),
      email: clean(args.email, 254).toLowerCase(),
      subject: clean(args.subject, 150),
      message: clean(args.message, 4000),
      consent: args.consent,
      createdAt: Date.now(),
      status: "new",
    });
  },
});

export const submitCommission = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    subject: v.string(),
    inspiration: v.string(),
    dimensions: v.string(),
    budget: v.string(),
    timing: v.string(),
    notes: v.string(),
    inspirationFiles: v.array(inspirationFileValidator),
    consent: v.boolean(),
  },
  returns: v.id("commissionEnquiries"),
  handler: async (ctx, args) => {
    if (
      !clean(args.name, 100) ||
      !validEmail(args.email) ||
      !clean(args.inspiration, 4000) ||
      !args.consent
    )
      throw new Error("Please complete all required fields.");
    if (args.inspirationFiles.length > 3)
      throw new Error("You can upload up to 3 inspiration images.");

    const storageIds = new Set<string>();
    const inspirationFiles: StoredInspirationFile[] = [];
    for (const file of args.inspirationFiles) {
      if (storageIds.has(file.storageId))
        throw new Error("Duplicate inspiration image.");
      storageIds.add(file.storageId);
      const metadata = await ctx.db.system.get("_storage", file.storageId);
      if (!metadata)
        throw new Error("An inspiration image could not be found.");
      const contentType = metadata.contentType;
      if (
        contentType !== "image/jpeg" &&
        contentType !== "image/png" &&
        contentType !== "image/webp"
      )
        throw new Error("Unsupported inspiration image type.");
      if (metadata.size > MAX_IMAGE_BYTES)
        throw new Error("An inspiration image is larger than 10 MB.");
      inspirationFiles.push({
        storageId: file.storageId,
        fileName: clean(file.fileName, 180),
        contentType,
        size: metadata.size,
      });
    }

    return await ctx.db.insert("commissionEnquiries", {
      name: clean(args.name, 100),
      email: clean(args.email, 254).toLowerCase(),
      phone: clean(args.phone, 50),
      subject: clean(args.subject, 150),
      inspiration: clean(args.inspiration, 4000),
      dimensions: clean(args.dimensions, 120),
      budget: clean(args.budget, 120),
      timing: clean(args.timing, 120),
      notes: clean(args.notes, 2000),
      inspirationFiles,
      consent: args.consent,
      createdAt: Date.now(),
      status: "new",
    });
  },
});
