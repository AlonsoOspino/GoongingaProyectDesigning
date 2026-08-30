"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { uploadAnnouncementImage } from "@/lib/api/announcement";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import studio from "@/announcements/studio.module.css";

/*
 * Picture field for an announcement.
 *
 * Uploading was not possible before: the studio asked for a URL, so an image
 * had to be hosted somewhere else first. Files now go to the same media volume
 * as every other upload. The URL box stays, because an image that already lives
 * somewhere should not have to be re-uploaded to be used.
 */
export function ImageField({
  value,
  name,
  onChange,
}: {
  value: string;
  name?: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    const token = readNetworkSessionToken();
    if (!token) {
      setError("Your session expired. Sign in again to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadAnnouncementImage(token, file, name);
      onChange(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload that image.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={studio.imageField}>
      <span className={studio.fieldLabel}>Image</span>

      <div className={studio.imageRow}>
        <div className={studio.imagePreview} data-empty={value ? "false" : "true"}>
          {value ? (
            <img src={value} alt="" onError={() => setError("That image could not be loaded.")} />
          ) : (
            <ImagePlus size={22} aria-hidden />
          )}
        </div>

        <div className={studio.imageActions}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className={studio.fileInput}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <button
            type="button"
            className={studio.secondary}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 size={15} className={studio.spin} /> : <ImagePlus size={15} />}
            {uploading ? "Uploading..." : value ? "Replace image" : "Upload image"}
          </button>

          {value ? (
            <button type="button" className={studio.danger} onClick={() => onChange("")}>
              <Trash2 size={15} /> Remove
            </button>
          ) : null}

          <input
            className={studio.imageUrlInput}
            value={value}
            placeholder="…or paste an image URL"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>

      {error ? <p className={studio.fieldError}>{error}</p> : null}
    </div>
  );
}
