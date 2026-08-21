import { v } from "convex/values";
import { mutation } from "./_generated/server";

const clean = (value: string, max: number) => value.trim().slice(0, max);
const validEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);

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
      consent: args.consent,
      createdAt: Date.now(),
      status: "new",
    });
  },
});
