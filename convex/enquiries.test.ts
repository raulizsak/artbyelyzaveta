/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const commissionArgs = {
  name: "Avery Collector",
  email: "AVERY@EXAMPLE.COM",
  phone: "",
  subject: "",
  inspiration: "A calm place remembered from childhood.",
  dimensions: "",
  budget: "",
  timing: "",
  notes: "",
  consent: true,
};

describe("commission inspiration files", () => {
  test("stores validated Convex storage references with the enquiry", async () => {
    const t = convexTest(schema, modules);
    const image = new Blob([new Uint8Array([137, 80, 78, 71])], {
      type: "image/png",
    });
    const storageId = await t.run((ctx) => ctx.storage.store(image));
    await t.run((ctx) =>
      (
        ctx.db as unknown as {
          patch: (
            id: Id<"_storage">,
            value: { contentType: string },
          ) => Promise<void>;
        }
      ).patch(storageId, { contentType: "image/png" }),
    );

    const enquiryId = await t.mutation(api.enquiries.submitCommission, {
      ...commissionArgs,
      inspirationFiles: [
        {
          storageId,
          fileName: "  childhood-place.png  ",
          contentType: "image/png",
          size: image.size,
        },
      ],
    });

    const enquiry = await t.run((ctx) => ctx.db.get(enquiryId));
    expect(enquiry).toMatchObject({
      email: "avery@example.com",
      inspirationFiles: [
        {
          storageId,
          fileName: "childhood-place.png",
          contentType: "image/png",
          size: image.size,
        },
      ],
    });
    expect(JSON.stringify(enquiry)).not.toContain("data:image");
  });

  test("rejects an unsupported stored file even when the client claims it is an image", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["not an image"], { type: "text/plain" })),
    );
    await t.run((ctx) =>
      (
        ctx.db as unknown as {
          patch: (
            id: Id<"_storage">,
            value: { contentType: string },
          ) => Promise<void>;
        }
      ).patch(storageId, { contentType: "text/plain" }),
    );

    await expect(
      t.mutation(api.enquiries.submitCommission, {
        ...commissionArgs,
        inspirationFiles: [
          {
            storageId,
            fileName: "reference.png",
            contentType: "image/png",
            size: 12,
          },
        ],
      }),
    ).rejects.toThrow("Unsupported inspiration image type.");
  });
});
