"use client";

import { useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveEditorialPost } from "./actions";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function EditorialUploadForm({
  postId,
  children,
}: {
  postId: string | null;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const uploaded = useRef<{ file: File; url: string } | null>(null);

  async function submit(formData: FormData) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");

    try {
      const file = formData.get("cover_image");

      // Image bytes must never enter the Server Action request.
      formData.delete("cover_image");

      if (file instanceof File && file.size > 0) {
        const extension = extensions[file.type];
        if (!extension || file.size > 8 * 1024 * 1024) {
          setError("Choose a JPG, PNG, WebP, or GIF image no larger than 8 MB.");
          return;
        }

        if (uploaded.current?.file !== file) {
          const supabase = createClient();
          const path = `${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("editorial-media")
            .upload(path, file, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            setError(`Image upload failed: ${uploadError.message}`);
            return;
          }

          uploaded.current = {
            file,
            url: supabase.storage
              .from("editorial-media")
              .getPublicUrl(path).data.publicUrl,
          };
        }

        formData.set("existing_cover_url", uploaded.current!.url);
      }
    } catch {
      setError("The image could not be uploaded. Check your connection and retry.");
      submitting.current = false;
      setBusy(false);
      return;
    } finally {
      // Validation and upload failures must leave the form usable.
      submitting.current = false;
      setBusy(false);
    }

    submitting.current = true;
    setBusy(true);
    try {
      await saveEditorialPost(postId, formData);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="editorial-form" action={submit} aria-busy={busy}>
      {error && <p className="operation-error" role="alert">{error}</p>}
      {busy && <p role="status">Uploading image and saving post…</p>}
      <fieldset
        disabled={busy}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        {children}
      </fieldset>
    </form>
  );
}