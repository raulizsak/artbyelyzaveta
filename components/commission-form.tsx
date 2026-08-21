"use client";

import Image from "next/image";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Send,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

type CommissionValues = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  inspiration: string;
  dimensions: string;
  budget: string;
  timing: string;
  notes: string;
  consent: boolean;
};
type RequiredField = "name" | "email" | "inspiration" | "consent";
type ErrorMap = Partial<Record<RequiredField, string>>;
type AllowedMime = "image/jpeg" | "image/png" | "image/webp";
type UploadStatus = "ready" | "uploading" | "uploaded" | "error";
type UploadItem = {
  key: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  storageId?: Id<"_storage">;
};
type StoredUpload = {
  storageId: Id<"_storage">;
  fileName: string;
  contentType: AllowedMime;
  size: number;
};

const empty: CommissionValues = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  inspiration: "",
  dimensions: "",
  budget: "",
  timing: "",
  notes: "",
  consent: false,
};
const allowedTypes = new Set<AllowedMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const isAllowedType = (type: string): type is AllowedMime =>
  allowedTypes.has(type as AllowedMime);
const formatFileSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const validate = (values: CommissionValues): ErrorMap => {
  const errors: ErrorMap = {};
  if (!values.name.trim()) errors.name = "Please enter your full name.";
  if (!/^\S+@\S+\.\S+$/.test(values.email))
    errors.email = "Please enter a valid email address.";
  if (!values.inspiration.trim())
    errors.inspiration = "Please tell Lisa a little about your idea.";
  if (!values.consent)
    errors.consent =
      "Please confirm that we can use these details to respond to your enquiry.";
  return errors;
};

function OilPaintTubeIcon() {
  return (
    <span aria-hidden="true" className="paint-tube-mark">
      <svg className="paint-tube-icon" viewBox="0 0 28 28">
        <path d="M8.8 4.5h10.4l1.5 14.2-2.9 2.8h-7.6l-2.9-2.8L8.8 4.5Z" />
        <path d="M9.1 7h10.1" />
        <path d="M11.1 21.5h5.8v2.8h-5.8z" />
        <path d="M14 17V9m-3 3 3-3 3 3" />
      </svg>
      <span className="paint-tube-mark__drop" />
    </span>
  );
}

export function CommissionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadsRef = useRef<UploadItem[]>([]);
  const shakeTimerRef = useRef<number | null>(null);
  const generateUploadUrl = useMutation(api.enquiries.generateUploadUrl);
  const submit = useMutation(api.enquiries.submitCommission);
  const [form, setForm] = useState<CommissionValues>(empty);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [shaking, setShaking] = useState<RequiredField[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [state, setState] = useState<
    "idle" | "uploading" | "sending" | "success" | "error"
  >("idle");
  const [formError, setFormError] = useState("");
  const isBusy = state === "uploading" || state === "sending";

  useEffect(() => {
    formRef.current?.setAttribute("data-ready", "true");
  }, []);
  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);
  useEffect(
    () => () => {
      uploadsRef.current.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl),
      );
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    },
    [],
  );

  const update = (key: keyof CommissionValues, value: string | boolean) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (submitted && key in errors) {
      const nextErrors = validate(next);
      setErrors((current) => {
        if (nextErrors[key as RequiredField]) return current;
        const updated = { ...current };
        delete updated[key as RequiredField];
        return updated;
      });
    }
    if (state === "error") setState("idle");
  };

  const triggerErrors = (nextErrors: ErrorMap) => {
    const fields = Object.keys(nextErrors) as RequiredField[];
    setErrors(nextErrors);
    setSubmitted(true);
    setShaking(fields);
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => setShaking([]), 330);
    window.requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${fields[0]}"]`)
        ?.focus();
    });
  };

  const addFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.some((file) => !isAllowedType(file.type))) {
      setUploadError("Please upload a JPG, PNG or WEBP image.");
      return;
    }
    if (incoming.some((file) => file.size > MAX_IMAGE_BYTES)) {
      setUploadError(
        "This image is larger than 10 MB. Please choose a smaller file.",
      );
      return;
    }
    const existingKeys = new Set(uploads.map((item) => item.key));
    const additions = incoming
      .map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        file,
      }))
      .filter(({ key }) => !existingKeys.has(key));
    if (uploads.length + additions.length > 3) {
      setUploadError("You can upload up to 3 inspiration images.");
      return;
    }
    setUploadError("");
    setUploads((current) => [
      ...current,
      ...additions.map(({ key, file }) => ({
        key,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "ready" as const,
      })),
    ]);
  };

  const removeFile = (key: string) => {
    setUploads((current) => {
      const item = current.find((entry) => entry.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return current.filter((entry) => entry.key !== key);
    });
    setUploadError("");
  };

  const updateUpload = (key: string, updateValue: Partial<UploadItem>) =>
    setUploads((current) =>
      current.map((item) =>
        item.key === key ? { ...item, ...updateValue } : item,
      ),
    );

  const uploadFiles = async (): Promise<StoredUpload[]> => {
    const stored: StoredUpload[] = [];
    for (const item of uploads) {
      if (item.storageId) {
        stored.push({
          storageId: item.storageId,
          fileName: item.file.name,
          contentType: item.file.type as AllowedMime,
          size: item.file.size,
        });
        continue;
      }
      updateUpload(item.key, { status: "uploading" });
      try {
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": item.file.type },
          body: item.file,
        });
        if (!response.ok) throw new Error("upload failed");
        const result = (await response.json()) as { storageId?: string };
        if (!result.storageId) throw new Error("missing storage id");
        const storageId = result.storageId as Id<"_storage">;
        updateUpload(item.key, { status: "uploaded", storageId });
        stored.push({
          storageId,
          fileName: item.file.name,
          contentType: item.file.type as AllowedMime,
          size: item.file.size,
        });
      } catch {
        updateUpload(item.key, { status: "error" });
        setUploadError("We couldn't upload this image. Please try again.");
        throw new Error("upload failed");
      }
    }
    return stored;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length) {
      triggerErrors(nextErrors);
      return;
    }
    setErrors({});
    setFormError("");
    try {
      setState("uploading");
      const inspirationFiles = await uploadFiles();
      setState("sending");
      await submit({ ...form, inspirationFiles });
      uploads.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setUploads([]);
      setForm(empty);
      setSubmitted(false);
      setState("success");
    } catch (caught) {
      setState("error");
      if (!(caught instanceof Error && caught.message === "upload failed"))
        setFormError(
          "Your enquiry could not be saved. Please try again or contact the artist by email.",
        );
    }
  };

  const errorMessage = (key: RequiredField) =>
    errors[key] ? (
      <small className="field-error" id={`commission-${key}-error`}>
        <CircleAlert aria-hidden="true" size={14} /> {errors[key]}
      </small>
    ) : null;

  const input = (
    key: keyof CommissionValues,
    label: string,
    placeholder: string,
    options?: { required?: boolean; type?: string; autoComplete?: string },
  ) => {
    const error = errors[key as RequiredField];
    return (
      <label
        className={cn(
          "form-field",
          error && "form-field--invalid",
          shaking.includes(key as RequiredField) && "form-field--shake",
        )}
        htmlFor={`commission-${key}`}
      >
        <span>
          {label}
          {options?.required ? " *" : ""}
        </span>
        <input
          aria-describedby={error ? `commission-${key}-error` : undefined}
          aria-invalid={error ? "true" : undefined}
          autoComplete={options?.autoComplete}
          id={`commission-${key}`}
          name={key}
          onChange={(event) => update(key, event.target.value)}
          placeholder={placeholder}
          type={options?.type ?? "text"}
          value={String(form[key])}
        />
        {errorMessage(key as RequiredField)}
      </label>
    );
  };

  if (state === "success")
    return (
      <section className="form-success" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <p className="eyebrow">Enquiry received</p>
        <h2>Your idea is on its way.</h2>
        <p>
          Thank you. Elyzaveta will review the details and respond personally
          about fit and availability.
        </p>
        <button
          className="text-button"
          onClick={() => setState("idle")}
          type="button"
        >
          Start another enquiry
        </button>
      </section>
    );

  return (
    <form className="enquiry-form" noValidate onSubmit={onSubmit} ref={formRef}>
      <div className="form-grid two-col">
        {input("name", "Name", "Full name", {
          required: true,
          autoComplete: "name",
        })}
        {input("email", "Email", "name@example.com", {
          required: true,
          type: "email",
          autoComplete: "email",
        })}
        {input("phone", "Phone", "+61 412 345 678", {
          type: "tel",
          autoComplete: "tel",
        })}
        {input(
          "subject",
          "Subject",
          "e.g. A countryside landscape from my childhood",
        )}
        {input("dimensions", "Approximate dimensions", "e.g. 80 × 60 cm")}
        {input("budget", "Indicative budget", "e.g. A$800–A$1,200")}
        {input("timing", "Preferred timing", "e.g. Within 2–3 months")}

        <div className="upload-field" aria-busy={state === "uploading"}>
          <span className="upload-field__label">Upload your inspiration</span>
          <div
            className={cn(
              "upload-dropzone",
              dragActive && "upload-dropzone--active",
              state === "uploading" && "upload-dropzone--uploading",
            )}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!isBusy) setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              if (!isBusy) addFiles(event.dataTransfer.files);
            }}
          >
            <OilPaintTubeIcon />
            <span className="upload-dropzone__copy">
              <strong>Upload your inspiration</strong>
              <span id="commission-upload-help">
                {state === "uploading"
                  ? "Painting in progress · uploading photos"
                  : uploads.length
                    ? `${uploads.length} of 3 photos selected`
                    : "JPG, PNG or WEBP · up to 10 MB each"}
              </span>
            </span>
            <button
              aria-describedby="commission-upload-help"
              className="upload-choose"
              disabled={isBusy || uploads.length >= 3}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Choose photos
            </button>
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-describedby="commission-upload-help"
              aria-label="Choose up to 3 inspiration images"
              className="visually-hidden"
              disabled={isBusy}
              multiple
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
          </div>
          {uploadError ? (
            <small className="field-error" role="alert">
              <CircleAlert aria-hidden="true" size={14} /> {uploadError}
            </small>
          ) : null}
          {uploads.length ? (
            <div className="upload-list" aria-live="polite">
              {uploads.map((item) => (
                <article className="upload-preview" key={item.key}>
                  <Image
                    alt=""
                    height={58}
                    src={item.previewUrl}
                    unoptimized
                    width={58}
                  />
                  <div>
                    <strong>{item.file.name}</strong>
                    <span>{formatFileSize(item.file.size)}</span>
                    {item.status === "uploading" ? (
                      <div
                        aria-label={`Uploading ${item.file.name}`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuetext="Uploading"
                        className="upload-progress"
                        role="progressbar"
                      >
                        <span />
                      </div>
                    ) : null}
                  </div>
                  <span className="upload-preview__status">
                    {item.status === "uploading" ? (
                      <span className="upload-state">Uploading…</span>
                    ) : null}
                    {item.status === "uploaded" ? (
                      <span className="upload-state upload-state--complete">
                        <Check aria-hidden="true" size={14} /> Ready
                      </span>
                    ) : null}
                  </span>
                  <button
                    aria-label={`Remove ${item.file.name}`}
                    disabled={isBusy}
                    onClick={() => removeFile(item.key)}
                    type="button"
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <label
          className={cn(
            "form-field form-field--wide",
            errors.inspiration && "form-field--invalid",
            shaking.includes("inspiration") && "form-field--shake",
          )}
          htmlFor="commission-inspiration"
        >
          <span>Inspiration / story *</span>
          <textarea
            aria-describedby={
              errors.inspiration ? "commission-inspiration-error" : undefined
            }
            aria-invalid={errors.inspiration ? "true" : undefined}
            id="commission-inspiration"
            name="inspiration"
            onChange={(event) => update("inspiration", event.target.value)}
            placeholder="Tell Lisa about the place, memory, mood or scene you would like painted."
            rows={7}
            value={form.inspiration}
          />
          {errorMessage("inspiration")}
        </label>
        <label
          className="form-field form-field--wide"
          htmlFor="commission-notes"
        >
          <span>Anything else?</span>
          <textarea
            id="commission-notes"
            name="notes"
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Add any colours, framing preferences, delivery details or other information that may help."
            rows={4}
            value={form.notes}
          />
        </label>
        <div
          className={cn(
            "consent-group form-field--wide",
            errors.consent && "form-field--invalid",
            shaking.includes("consent") && "form-field--shake",
          )}
        >
          <label className="consent-field" htmlFor="commission-consent">
            <input
              aria-describedby={
                errors.consent ? "commission-consent-error" : undefined
              }
              aria-invalid={errors.consent ? "true" : undefined}
              checked={form.consent}
              id="commission-consent"
              name="consent"
              onChange={(event) => update("consent", event.target.checked)}
              type="checkbox"
            />
            <span>
              I consent to Art by Elyzaveta using these details to respond to my
              commission enquiry. *
            </span>
          </label>
          {errorMessage("consent")}
        </div>
      </div>
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <button className="primary-action" disabled={isBusy} type="submit">
        {isBusy ? (
          <LoaderCircle
            aria-hidden="true"
            className="upload-spinner"
            size={17}
          />
        ) : (
          <Send aria-hidden="true" size={17} />
        )}
        {state === "uploading"
          ? "Uploading inspiration…"
          : state === "sending"
            ? "Sending enquiry…"
            : "Send commission enquiry"}
      </button>
    </form>
  );
}
