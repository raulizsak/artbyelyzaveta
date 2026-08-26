"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
export function ReturnEvidenceUploader({
  returnId,
  userId,
}: {
  returnId: string;
  userId: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  async function upload() {
    if (!files.length) return;
    if (
      files.length > 5 ||
      files.some(
        (file) => !allowed.has(file.type) || file.size > 5 * 1024 * 1024,
      )
    ) {
      setError("Choose up to five JPG, PNG or WEBP images under 5 MB each.");
      return;
    }
    setState("busy");
    setError("");
    try {
      const supabase = createClient();
      const records = [];
      for (const file of files) {
        const extension =
          file.type === "image/png"
            ? "png"
            : file.type === "image/webp"
              ? "webp"
              : "jpg";
        const path = `${userId}/${returnId}/${crypto.randomUUID()}.${extension}`;
        const result = await supabase.storage
          .from("return-evidence")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (result.error) throw result.error;
        records.push({ path, mimeType: file.type, bytes: file.size });
      }
      const response = await fetch(
        `/api/account/returns/${returnId}/evidence`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: records }),
        },
      );
      if (!response.ok) throw new Error("metadata-failed");
      setState("sent");
    } catch {
      setState("error");
      setError("We couldn't save the evidence photos. Please try again.");
    }
  }
  if (state === "sent")
    return <p className="form-success-inline">Private evidence uploaded.</p>;
  return (
    <div className="return-evidence-upload">
      <label className="form-field">
        <span>Evidence photos (optional)</span>
        <input
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          type="file"
        />
        <small>
          Up to 5 private images, 5 MB each. Only you and an MFA-verified
          administrator can access them.
        </small>
      </label>
      <button
        className="secondary-action"
        disabled={state === "busy" || !files.length}
        onClick={upload}
        type="button"
      >
        {state === "busy" ? "Uploading privately…" : "Upload evidence"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
