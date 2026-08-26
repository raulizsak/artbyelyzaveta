"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PaintingInput = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  story: string;
  priceCents: number;
  currency: string;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  medium: string | null;
  surface: string | null;
  category: string | null;
  orientation: "portrait" | "landscape" | "square" | "other" | null;
  framed: boolean;
  frameDescription: string | null;
  signed: boolean;
  readyToHang: boolean;
  certificate: boolean;
  status: "draft" | "available" | "reserved" | "sold" | "archived";
  featured: boolean;
  year: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

const blank: PaintingInput = {
  slug: "",
  title: "",
  description: "",
  story: "",
  priceCents: 0,
  currency: "AUD",
  widthCm: null,
  heightCm: null,
  depthCm: null,
  medium: "Oil",
  surface: "Canvas",
  category: null,
  orientation: "landscape",
  framed: false,
  frameDescription: null,
  signed: true,
  readyToHang: true,
  certificate: true,
  status: "draft",
  featured: false,
  year: new Date().getFullYear(),
  seoTitle: null,
  seoDescription: null,
};
const variants = [
  { name: "thumbnail", max: 320, quality: 0.78 },
  { name: "card", max: 900, quality: 0.82 },
  { name: "main", max: 1800, quality: 0.84 },
  { name: "large", max: 2400, quality: 0.86 },
] as const;

async function imageVariant(bitmap: ImageBitmap, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("image-processing-unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("image-processing-failed");
  return { blob, width, height };
}

export function PaintingEditor({
  initial = blank,
}: {
  initial?: PaintingInput;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = <K extends keyof PaintingInput>(
    key: K,
    value: PaintingInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  async function uploadMedia(paintingId: string) {
    const supabase = createClient();
    const records: Record<string, unknown>[] = [];
    for (let position = 0; position < files.length; position += 1) {
      const file = files[position];
      if (file.size > 20 * 1024 * 1024)
        throw new Error(`${file.name} is larger than 20 MB.`);
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 12000 || bitmap.height > 12000)
        throw new Error(`${file.name} has dimensions above 12,000 px.`);
      const mediaId = crypto.randomUUID();
      const kind = position === 0 ? "artwork" : "room";
      const extension =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      const originalPath = `${paintingId}/${mediaId}/original.${extension}`;
      setProgress(`Uploading original ${position + 1} of ${files.length}…`);
      const original = await supabase.storage
        .from("artwork-originals")
        .upload(originalPath, file, { contentType: file.type, upsert: false });
      if (original.error) throw original.error;
      records.push({
        kind,
        storage_path: originalPath,
        variant: "original",
        width: bitmap.width,
        height: bitmap.height,
        bytes: file.size,
        mime_type: file.type,
        alt_text: `${form.title} ${kind === "room" ? "shown in a room" : "original painting"}`,
        position,
      });
      for (const variant of variants) {
        setProgress(
          `Creating ${variant.name} image ${position + 1} of ${files.length}…`,
        );
        const output = await imageVariant(bitmap, variant.max, variant.quality);
        const path = `${paintingId}/${mediaId}/${variant.name}.webp`;
        const uploaded = await supabase.storage
          .from("artwork-public")
          .upload(path, output.blob, {
            contentType: "image/webp",
            upsert: false,
          });
        if (uploaded.error) throw uploaded.error;
        records.push({
          kind,
          storage_path: path,
          variant: variant.name,
          width: output.width,
          height: output.height,
          bytes: output.blob.size,
          mime_type: "image/webp",
          alt_text: `${form.title} ${kind === "room" ? "shown in a room setting" : "original painting"}`,
          position,
        });
      }
      bitmap.close();
    }
    if (records.length) {
      const response = await fetch(`/api/admin/paintings/${paintingId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media: records }),
      });
      if (!response.ok) throw new Error("Media metadata could not be saved.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setProgress("Saving painting details…");
    try {
      const endpoint = form.id
        ? `/api/admin/paintings/${form.id}`
        : "/api/admin/paintings";
      const response = await fetch(endpoint, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id)
        throw new Error(data.error || "Painting could not be saved.");
      await uploadMedia(data.id);
      setProgress("Painting saved.");
      router.replace(`/admin/paintings/${data.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Painting could not be saved.",
      );
    }
    setBusy(false);
  }

  const text = (
    key: keyof PaintingInput,
    label: string,
    options?: { type?: string; step?: string },
  ) => (
    <label className="form-field">
      <span>{label}</span>
      <input
        onChange={(e) => {
          const value =
            options?.type === "number"
              ? e.target.value
                ? Number(e.target.value)
                : null
              : e.target.value;
          update(key, value as never);
        }}
        step={options?.step}
        type={options?.type}
        value={form[key] === null ? "" : String(form[key])}
      />
    </label>
  );
  const check = (
    key: "framed" | "signed" | "readyToHang" | "certificate" | "featured",
    label: string,
  ) => (
    <label className="consent-field">
      <input
        checked={form[key]}
        onChange={(e) => update(key, e.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
  return (
    <form className="account-panel painting-editor" onSubmit={submit}>
      <p className="eyebrow">Catalogue editor</p>
      <h1>{form.id ? `Edit ${form.title}` : "Add a painting"}</h1>
      <div className="form-grid two-col">
        {text("title", "Title")}
        {text("slug", "URL slug")}
        {text("priceCents", "Price in cents", { type: "number" })}
        {text("currency", "Currency")}
        {text("widthCm", "Width cm", { type: "number", step: "0.01" })}
        {text("heightCm", "Height cm", { type: "number", step: "0.01" })}
        {text("depthCm", "Depth cm", { type: "number", step: "0.01" })}
        {text("year", "Year", { type: "number" })}
        {text("medium", "Medium")}
        {text("surface", "Surface")}
        {text("category", "Category")}
        {text("frameDescription", "Frame description")}
        <label className="form-field">
          <span>Orientation</span>
          <select
            onChange={(e) =>
              update(
                "orientation",
                e.target.value as PaintingInput["orientation"],
              )
            }
            value={form.orientation ?? "other"}
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
            <option value="square">Square</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="form-field">
          <span>Status</span>
          <select
            onChange={(e) =>
              update("status", e.target.value as PaintingInput["status"])
            }
            value={form.status}
          >
            <option value="draft">Draft</option>
            <option value="available">Available</option>
            <option value="sold">Sold</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      <label className="form-field">
        <span>Description</span>
        <textarea
          onChange={(e) => update("description", e.target.value)}
          rows={4}
          value={form.description}
        />
      </label>
      <label className="form-field">
        <span>Story</span>
        <textarea
          onChange={(e) => update("story", e.target.value)}
          rows={7}
          value={form.story}
        />
      </label>
      <div className="editor-checks">
        {check("framed", "Framed")}
        {check("signed", "Signed")}
        {check("readyToHang", "Ready to hang")}
        {check("certificate", "Certificate included")}
        {check("featured", "Featured painting")}
      </div>
      <div className="form-grid two-col">
        {text("seoTitle", "SEO title")}
        {text("seoDescription", "SEO description")}
      </div>
      <label className="form-field">
        <span>Artwork and room images</span>
        <input
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          type="file"
        />
        <small>
          The first image is the artwork; additional images are room previews.
          Variants are generated in your browser and uploaded directly to
          Supabase. Maximum 20 MB / 12,000 px each.
        </small>
      </label>
      {progress ? <p className="notice">{progress}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      <button className="primary-action" disabled={busy} type="submit">
        {busy ? "Saving and processing images…" : "Save painting"}
      </button>
    </form>
  );
}
