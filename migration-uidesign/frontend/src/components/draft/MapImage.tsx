"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

/**
 * Preload an image URL and report when its bytes are decoded.
 *
 * Returns `true` once the browser has the image fully ready (or `src`
 * is null/empty -> we treat that as "nothing to wait for"). Cached
 * images are detected synchronously via `img.complete`, so we never
 * get stuck on "Loading..." just because `onload` already fired before
 * we attached the listener.
 */
export function useImageReady(src: string | null | undefined): boolean {
  const [readySrc, setReadySrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setReadySrc(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    const markReady = () => {
      if (!cancelled) setReadySrc(src);
    };

    img.onload = markReady;
    // Even on error we unblock so the UI can fall back to its placeholder
    // instead of hanging on a "Loading..." screen forever.
    img.onerror = markReady;
    img.src = src;

    // If the browser had this URL cached and decoded, `complete` is true
    // synchronously and `onload` may have already fired (or will not fire
    // again). Mark ready in that case so we don't get stuck.
    if (img.complete) {
      markReady();
    }

    return () => {
      cancelled = true;
    };
  }, [src]);

  return !!src && readySrc === src;
}

/**
 * Image renderer that hides a partially-loaded `<img>` behind a
 * "Loading..." placeholder until the bytes are actually decoded.
 *
 * Used for the central map preview shown on every draft phase
 * (map picking, ban, playing, end-map) so the captain/manager view
 * never flashes a broken / empty box while the new map's artwork
 * is still downloading.
 */
export function MapImage({
  src,
  alt,
  className,
  fallbackInitial,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackInitial?: string;
}) {
  const ready = useImageReady(src);

  if (!src) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center bg-surface-elevated text-muted",
          className,
        )}
      >
        <span className="text-4xl font-bold">{fallbackInitial ?? "?"}</span>
      </div>
    );
  }

  return (
    <div className={clsx("relative bg-surface-elevated", className)}>
      {ready && (
        <img
          // Use src as key so React fully remounts the <img> when the URL changes.
          key={src}
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-opacity duration-200 opacity-100"
        />
      )}
      {!ready && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs uppercase tracking-widest text-muted">
              Loading map...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Page-level map backdrop that only paints the CSS background image
 * AFTER the bytes have been fetched. Prevents the "white flash" that
 * happens between phases while the new map artwork is still downloading.
 */
export function MapBackground({ src }: { src: string | null | undefined }) {
  const ready = useImageReady(src);

  if (!ready || !src) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-300"
        style={{ backgroundImage: `url(${src})` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-background/75"
      />
    </>
  );
}
