"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { uploadMediaToBlob, type BlobMediaType } from "@/lib/blobUpload";

type MediaUploadFieldProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  type: BlobMediaType;
  token: string;
  placeholder?: string;
  hint?: string;
  onDurationChange?: (durationSeconds: number | null) => void;
};

const mediaConfig = {
  video: { accept: "video/mp4,video/webm,video/quicktime", empty: "No video", action: "Upload video" },
  audio: { accept: "audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/aac", empty: "No audio", action: "Upload audio" },
} satisfies Record<BlobMediaType, { accept: string; empty: string; action: string }>;

export function MediaUploadField({ label, value, onChange, type, token, placeholder, hint, onDurationChange }: MediaUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = mediaConfig[type];

  async function handleFileChange(file?: File) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await uploadMediaToBlob(file, type, token));
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
      {value ? (
        type === "video" ? <video src={value} className="h-24 w-full rounded-md border border-border bg-black object-cover" controls preload="metadata" /> : (
          <audio
            src={value}
            className="w-full"
            controls
            preload="metadata"
            onLoadedMetadata={(event) => {
              const duration = event.currentTarget.duration;
              onDurationChange?.(Number.isFinite(duration) && duration > 0 ? duration : null);
            }}
          />
        )
      ) : (
        <div className="flex h-14 items-center rounded-md border border-dashed border-border bg-surface-elevated px-3 text-sm text-muted">{config.empty}</div>
      )}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || `Paste ${type} URL or upload a file`}
        className="w-full rounded-md border border-input-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept={config.accept} className="hidden" onChange={(event) => void handleFileChange(event.target.files?.[0])} />
        <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "Uploading..." : config.action}
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); onDurationChange?.(null); }}>Clear</Button>}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
