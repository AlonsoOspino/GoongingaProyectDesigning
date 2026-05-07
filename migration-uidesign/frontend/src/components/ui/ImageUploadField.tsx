"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { uploadImageToBlob, type BlobImageType } from "@/lib/blobUpload";

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  type: BlobImageType;
  previewAlt?: string;
  previewClassName?: string;
  placeholder?: string;
}

export function ImageUploadField({
  label,
  value,
  onChange,
  type,
  previewAlt = "Uploaded image preview",
  previewClassName,
  placeholder = "Paste image URL or upload a file",
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(file?: File) {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const url = await uploadImageToBlob(file, type);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className={clsx(
            "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface text-xs text-muted",
            previewClassName
          )}
        >
          {value ? (
            <img src={value} alt={previewAlt} className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center">No image</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-md border border-input-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(event) => void handleFileChange(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload image"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
