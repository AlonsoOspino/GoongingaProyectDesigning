"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

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
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Reset loading state every time the source URL changes (e.g. between maps).
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [src]);

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
      <img
        // Use src as key so React fully remounts the <img> when the URL changes.
        // This guarantees onLoad fires for the new image even when the browser
        // has the previous one cached.
        key={src}
        src={src}
        alt={alt}
        className={clsx(
          "w-full h-full object-cover transition-opacity duration-200",
          loaded && !errored ? "opacity-100" : "opacity-0",
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setErrored(true);
          setLoaded(true);
        }}
      />
      {!loaded && (
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
      {errored && loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-elevated">
          <span className="text-4xl font-bold text-muted">
            {fallbackInitial ?? "?"}
          </span>
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
  const [readySrc, setReadySrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setReadySrc(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setReadySrc(src);
    };
    img.onerror = () => {
      if (!cancelled) setReadySrc(null);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!readySrc) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-300"
        style={{ backgroundImage: `url(${readySrc})` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-background/75"
      />
    </>
  );
}
