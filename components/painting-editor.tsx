"use client";

import Image from "next/image";
import { GripVertical, ImagePlus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDisplayValue } from "@/lib/presentation";
import { createClient } from "@/lib/supabase/client";

export type PaintingEditorMedia = {
  alt: string;
  groupKey: string;
  kind: "artwork" | "room" | "detail";
  position: number;
  src: string;
};

type PaintingInput = {
  id?: string;
  slug: string;
  title: string;
  description: string;
  story: string;
  priceAud: string;
  shippingAud: string;
  currency: "AUD";
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

type PendingImage = {
  file: File;
  groupKey: string;
  preview: string;
};

const blank: PaintingInput = {
  slug: "",
  title: "",
  description: "",
  story: "",
  priceAud: "",
  shippingAud: "0.00",
  currency: "AUD",
  widthCm: null,
  heightCm: null,
  depthCm: null,
  medium: "Oil paint",
  surface: "Canvas",
  category: "Expressionism",
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

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

const dollarsToCents = (value: string) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

const formatPreviewMoney = (value: string) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(dollarsToCents(value) / 100);

async function imageVariant(bitmap: ImageBitmap, max: number, quality: number) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Image processing is unavailable.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("The image could not be processed.");
  return { blob, width, height };
}

function EditorSection({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="painting-editor__section">
      <header>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function PaintingEditor({
  initial = blank,
  initialMedia = [],
}: {
  initial?: PaintingInput;
  initialMedia?: PaintingEditorMedia[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [existingMedia, setExistingMedia] = useState(
    [...initialMedia].sort((a, b) => a.position - b.position),
  );
  const [removedMedia, setRemovedMedia] = useState<string[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const previewUrls = useRef(new Set<string>());
  const [slugIsManual, setSlugIsManual] = useState(Boolean(initial.id));
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const update = <K extends keyof PaintingInput>(
    key: K,
    value: PaintingInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const allMedia = useMemo(
    () => [
      ...existingMedia.map((image) => ({ ...image, pending: false as const })),
      ...pendingImages.map((image, index) => ({
        alt: `${form.title || "Untitled painting"} image ${existingMedia.length + index + 1}`,
        groupKey: image.groupKey,
        kind: (existingMedia.length + index === 0 ? "artwork" : "room") as
          | "artwork"
          | "room",
        pending: true as const,
        position: existingMedia.length + index,
        src: image.preview,
      })),
    ],
    [existingMedia, form.title, pendingImages],
  );

  const mainImage = allMedia[0]?.src ?? null;

  function changeTitle(title: string) {
    setForm((current) => ({
      ...current,
      title,
      slug: slugIsManual ? current.slug : slugify(title),
    }));
  }

  function chooseImages(files: File[]) {
    const accepted = files.filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );
    const added = accepted.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.add(preview);
      return {
        file,
        groupKey: `pending:${crypto.randomUUID()}`,
        preview,
      };
    });
    setPendingImages((current) => [
      ...current,
      ...added,
    ]);
  }

  function moveMedia(groupKey: string, direction: -1 | 1) {
    const index = allMedia.findIndex((item) => item.groupKey === groupKey);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= allMedia.length) return;
    const reordered = [...allMedia];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setExistingMedia(
      reordered
        .filter((item) => !item.pending)
        .map((item, position) => ({ ...item, position })),
    );
    setPendingImages(
      reordered
        .filter((item) => item.pending)
        .map((item) => pendingImages.find((pending) => pending.groupKey === item.groupKey)!)
        .filter(Boolean),
    );
  }

  function removeMedia(groupKey: string) {
    const existing = existingMedia.find((item) => item.groupKey === groupKey);
    if (existing) {
      setRemovedMedia((current) => [...current, groupKey]);
      setExistingMedia((current) => current.filter((item) => item.groupKey !== groupKey));
      return;
    }
    setPendingImages((current) => {
      const target = current.find((item) => item.groupKey === groupKey);
      if (target) {
        URL.revokeObjectURL(target.preview);
        previewUrls.current.delete(target.preview);
      }
      return current.filter((item) => item.groupKey !== groupKey);
    });
  }

  async function uploadMedia(paintingId: string) {
    const supabase = createClient();
    const records: Record<string, unknown>[] = [];
    const uploadedGroupKeys: string[] = [];
    for (let position = 0; position < pendingImages.length; position += 1) {
      const { file } = pendingImages[position];
      if (file.size > 20 * 1024 * 1024)
        throw new Error(`${file.name} is larger than 20 MB.`);
      const bitmap = await createImageBitmap(file);
      if (bitmap.width > 12000 || bitmap.height > 12000)
        throw new Error(`${file.name} has dimensions above 12,000 px.`);
      const mediaId = crypto.randomUUID();
      const groupKey = `${paintingId}/${mediaId}`;
      const finalPosition = existingMedia.length + position;
      const kind = finalPosition === 0 ? "artwork" : "room";
      const extension =
        file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const originalPath = `${groupKey}/original.${extension}`;
      const completedBefore = position * (variants.length + 1);
      setProgressLabel(`Uploading ${file.name}…`);
      setProgress(Math.round((completedBefore / (pendingImages.length * 5)) * 100));
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
        position: finalPosition,
      });
      for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
        const variant = variants[variantIndex];
        setProgressLabel(`Preparing ${variant.name} view for ${file.name}…`);
        const output = await imageVariant(bitmap, variant.max, variant.quality);
        const path = `${groupKey}/${variant.name}.webp`;
        const uploaded = await supabase.storage
          .from("artwork-public")
          .upload(path, output.blob, { contentType: "image/webp", upsert: false });
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
          position: finalPosition,
        });
        setProgress(
          Math.round(
            ((completedBefore + variantIndex + 2) / (pendingImages.length * 5)) * 100,
          ),
        );
      }
      bitmap.close();
      uploadedGroupKeys.push(groupKey);
    }
    if (records.length) {
      const response = await fetch(`/api/admin/paintings/${paintingId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media: records }),
      });
      if (!response.ok) throw new Error("Image details could not be saved.");
    }
    return uploadedGroupKeys;
  }

  async function saveMediaChanges(paintingId: string) {
    for (const groupKey of removedMedia) {
      const response = await fetch(`/api/admin/paintings/${paintingId}/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupKey }),
      });
      if (!response.ok) throw new Error("An image could not be removed.");
    }
    const uploaded = await uploadMedia(paintingId);
    const groupKeys = [...existingMedia.map((item) => item.groupKey), ...uploaded];
    if (groupKeys.length) {
      const response = await fetch(`/api/admin/paintings/${paintingId}/media`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupKeys }),
      });
      if (!response.ok) throw new Error("The image order could not be saved.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setProgress(2);
    setProgressLabel("Saving painting details…");
    try {
      const endpoint = form.id ? `/api/admin/paintings/${form.id}` : "/api/admin/paintings";
      const response = await fetch(endpoint, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id)
        throw new Error(data.error || "Painting could not be saved.");
      await saveMediaChanges(data.id);
      setProgress(100);
      setProgressLabel("Painting saved.");
      router.replace(`/admin/paintings/${data.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Painting could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const numericField = (
    key: "widthCm" | "heightCm" | "depthCm" | "year",
    label: string,
    step = "1",
  ) => (
    <label className="form-field">
      <span>{label}</span>
      <input
        min={key === "year" ? 1900 : 0}
        onChange={(event) => update(key, event.target.value ? Number(event.target.value) : null)}
        step={step}
        type="number"
        value={form[key] ?? ""}
      />
    </label>
  );

  const checkbox = (
    key: "signed" | "readyToHang" | "certificate" | "featured",
    label: string,
  ) => (
    <label className="consent-field">
      <input checked={form[key]} onChange={(event) => update(key, event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );

  return (
    <form className="painting-editor-shell" onSubmit={submit}>
      <div className="painting-editor__form">
        <header className="painting-editor__heading">
          <div>
            <p className="eyebrow">Catalogue editor</p>
            <h1>{form.id ? `Edit ${form.title || "painting"}` : "Add a painting"}</h1>
            <p>Shape the catalogue listing and preview the customer experience as you work.</p>
          </div>
          <button className="primary-action" disabled={busy} type="submit">
            {busy ? "Saving…" : "Save painting"}
          </button>
        </header>

        <EditorSection description="The essentials customers see first." title="Basic information">
          <div className="form-grid two-col">
            <label className="form-field form-field--wide"><span>Painting title</span><input onChange={(event) => changeTitle(event.target.value)} required value={form.title} /></label>
            <label className="form-field"><span>Price (AUD)</span><div className="money-input"><span>$</span><input inputMode="decimal" onChange={(event) => update("priceAud", event.target.value)} placeholder="800.00" required value={form.priceAud} /></div></label>
            {numericField("year", "Year painted")}
            <label className="form-field"><span>Category</span><input list="painting-categories" onChange={(event) => update("category", event.target.value || null)} value={form.category ?? ""} /><datalist id="painting-categories"><option value="Expressionism" /><option value="Landscape" /></datalist></label>
            <label className="form-field"><span>Status</span><select onChange={(event) => update("status", event.target.value as PaintingInput["status"])} value={form.status}><option value="draft">Draft</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="archived">Archived</option></select></label>
          </div>
        </EditorSection>

        <EditorSection description="Measurements are recorded in centimetres." title="Artwork details">
          <div className="painting-editor__dimensions">{numericField("widthCm", "Width", "0.01")}{numericField("heightCm", "Height", "0.01")}{numericField("depthCm", "Depth", "0.01")}</div>
          <div className="form-grid two-col">
            <label className="form-field"><span>Painting medium</span><select onChange={(event) => update("medium", event.target.value)} value={form.medium ?? "Other"}><option>Oil paint</option><option>Acrylic paint</option><option>Watercolour</option><option>Mixed media</option><option>Other</option></select></label>
            <label className="form-field"><span>Painted on</span><select onChange={(event) => update("surface", event.target.value)} value={form.surface ?? "Other"}><option>Canvas</option><option>Linen</option><option>Wood panel</option><option>Paper</option><option>Other</option></select></label>
            <label className="form-field"><span>Artwork orientation</span><select onChange={(event) => update("orientation", event.target.value as PaintingInput["orientation"])} value={form.orientation ?? "other"}><option value="landscape">Landscape</option><option value="portrait">Portrait</option><option value="square">Square</option><option value="other">Other</option></select><small>The shape and layout of the artwork.</small></label>
            <label className="form-field"><span>Frame</span><select onChange={(event) => update("framed", event.target.value === "framed")} value={form.framed ? "framed" : "unframed"}><option value="unframed">Unframed</option><option value="framed">Framed</option></select></label>
            {form.framed ? <label className="form-field form-field--wide"><span>Frame details (optional)</span><input onChange={(event) => update("frameDescription", event.target.value || null)} placeholder="Natural oak floating frame" value={form.frameDescription ?? ""} /></label> : null}
          </div>
        </EditorSection>

        <EditorSection description="Shipping is charged only when the customer selects Shipping. Personal Collection is always $0." title="Shipping & availability">
          <div className="form-grid two-col">
            <label className="form-field"><span>Shipping cost (AUD)</span><div className="money-input"><span>$</span><input inputMode="decimal" onChange={(event) => update("shippingAud", event.target.value)} placeholder="20.25" required value={form.shippingAud} /></div></label>
            <div className="painting-editor__currency"><span>Store currency</span><strong>AUD</strong><small>Managed automatically for this shop.</small></div>
          </div>
        </EditorSection>

        <EditorSection title="Description">
          <label className="form-field"><span>Short description</span><textarea maxLength={5000} onChange={(event) => update("description", event.target.value)} rows={4} value={form.description} /><small>A concise introduction for the product page.</small></label>
          <label className="form-field"><span>Story behind the painting</span><textarea maxLength={10000} onChange={(event) => update("story", event.target.value)} rows={7} value={form.story} /><small>The longer, personal artist’s note about this work.</small></label>
        </EditorSection>

        <EditorSection description="The first image is the main artwork image. Additional images become room or lifestyle views." title="Images">
          <label className="painting-editor__dropzone"><ImagePlus aria-hidden="true" size={26} /><strong>Add artwork and room images</strong><span>JPEG, PNG or WebP · maximum 20 MB and 12,000 px</span><input accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => chooseImages(Array.from(event.target.files ?? []))} type="file" /></label>
          {allMedia.length ? <div className="painting-media-list">{allMedia.map((image, index) => <article className="painting-media-item" key={image.groupKey}><div className="painting-media-item__thumb"><Image alt={image.alt} fill sizes="96px" src={image.src} unoptimized={image.pending} /></div><div><strong>{index === 0 ? "Main artwork image" : `Room / lifestyle image ${index}`}</strong><small>{image.pending ? "Ready to upload" : "Saved image"}</small></div><div className="painting-media-item__actions"><button aria-label="Move image earlier" disabled={index === 0} onClick={() => moveMedia(image.groupKey, -1)} type="button">↑</button><button aria-label="Move image later" disabled={index === allMedia.length - 1} onClick={() => moveMedia(image.groupKey, 1)} type="button">↓</button><button aria-label="Remove image" onClick={() => removeMedia(image.groupKey)} type="button"><Trash2 size={16} /></button><GripVertical aria-hidden="true" size={17} /></div></article>)}</div> : null}
          {busy ? <div aria-live="polite" className="painting-upload-progress"><div><span style={{ width: `${progress}%` }} /></div><p>{progressLabel}</p></div> : null}
        </EditorSection>

        <EditorSection title="Included & featured details"><div className="editor-checks">{checkbox("signed", "Signed by the artist")}{checkbox("readyToHang", "Ready to hang")}{checkbox("certificate", "Certificate of authenticity included")}{checkbox("featured", "Featured painting")}</div></EditorSection>

        <details className="painting-editor__advanced"><summary>SEO & advanced</summary><div className="form-grid two-col"><label className="form-field form-field--wide"><span>URL slug</span><input onChange={(event) => { setSlugIsManual(true); update("slug", slugify(event.target.value)); }} required value={form.slug} /><small>Generated from the title. Edit only when a custom URL is needed.</small></label><label className="form-field"><span>SEO title</span><input onChange={(event) => update("seoTitle", event.target.value || null)} value={form.seoTitle ?? ""} /></label><label className="form-field"><span>SEO description</span><textarea onChange={(event) => update("seoDescription", event.target.value || null)} rows={3} value={form.seoDescription ?? ""} /></label></div></details>

        {error ? <p className="form-error">{error}</p> : null}
        <div className="painting-editor__footer"><button className="primary-action" disabled={busy} type="submit">{busy ? "Saving and processing images…" : "Save painting"}</button></div>
      </div>

      <aside className="painting-live-preview">
        <div className="painting-live-preview__label"><span>Live product preview</span><span className="status-pill">{formatDisplayValue(form.status)}</span></div>
        <div className="painting-live-preview__image">{mainImage ? <Image alt={form.title || "Painting preview"} fill sizes="40vw" src={mainImage} unoptimized={mainImage.startsWith("blob:")} /> : <div><ImagePlus aria-hidden="true" size={30} /><span>Add a main image to preview the artwork</span></div>}{form.featured ? <span className="painting-live-preview__featured"><Star size={13} /> Featured</span> : null}</div>
        <p className="eyebrow">{form.medium || "Original painting"}{form.year ? ` · ${form.year}` : ""}</p>
        <h2>{form.title || "Untitled painting"}</h2>
        <strong className="painting-live-preview__price">{formatPreviewMoney(form.priceAud)}</strong>
        <span className="availability"><i /> {form.status === "available" ? "Available · One of one" : formatDisplayValue(form.status)}</span>
        <p>{form.description || "Your short description will appear here."}</p>
        <dl><div><dt>Dimensions</dt><dd>{[form.widthCm, form.heightCm, form.depthCm].filter((value) => value !== null).join(" × ") || "On request"}{form.widthCm ? " cm" : ""}</dd></div><div><dt>Medium</dt><dd>{form.medium || "—"}{form.surface ? ` on ${form.surface.toLowerCase()}` : ""}</dd></div><div><dt>Framing</dt><dd>{form.framed ? form.frameDescription || "Framed" : "Unframed"}</dd></div><div><dt>Shipping</dt><dd>{formatPreviewMoney(form.shippingAud)} · Collection $0.00</dd></div></dl>
      </aside>
    </form>
  );
}
