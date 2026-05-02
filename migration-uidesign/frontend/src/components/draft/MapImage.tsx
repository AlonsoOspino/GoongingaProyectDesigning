"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

/**
 * Module-level cache for image URLs that have already been fetched and
 * decoded by the browser at least once during this page's lifetime.
 *
 * Why this exists: every draft phase re-renders the page and the
 * `<MapBackground>` / `<MapImage>` components. Without a shared cache,
 * `useImageReady` would create a brand new `Image()` on every render
 * cycle and return `false` for at least one tick while the browser
 * served the bytes (even from HTTP cache), producing a ~1-2s flash on
 * every phase transition. By remembering "this URL is ready" at the
 * module level we can return `true` synchronously on the very first
 * render after the initial load, so the background never disappears.
 */
const readyUrls = new Set<string>();
const inflight = new Map<string, Promise<void>>();

/**
 * Preload an image URL. Resolves once the image is decoded (or errors,
 * which we treat as "done" so callers don't hang). Subsequent calls
 * with the same URL return the same in-flight Promise, and once it
 * has resolved we remember it forever in `readyUrls`.
 */
export function preloadImage(src: string | null | undefined): Promise<void> {
  if (!src) return Promise.resolve();
  if (readyUrls.has(src)) return Promise.resolve();

  const existing = inflight.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const img = new Image();
    const done = () => {
      readyUrls.add(src);
      inflight.delete(src);
      resolve();
    };
    img.onload = done;
    // Even on error we unblock so the UI can fall back instead of hanging.
    img.onerror = done;
    img.src = src;
    // Some browsers (esp. with disk cache) may have the image fully
    // decoded synchronously; in that case `complete` is true and
    // `onload` may have already fired.
    if (img.complete) done();
  });

  inflight.set(src, promise);
  return promise;
}

/** Preload many URLs in parallel. Useful for warming the cache up-front. */
export function preloadImages(urls: Array<string | null | undefined>): Promise<void[]> {
  return Promise.all(urls.map((u) => preloadImage(u)));
}

/** Synchronous "is this URL already cached and decoded?" check. */
export function isImageReady(src: string | null | undefined): boolean {
  return !!src && readyUrls.has(src);
}

/**
 * React hook that reports whether an image URL is fully loaded.
 *
 * Crucially this is backed by a module-level cache so once an image
 * has been decoded once, every later render that asks about the same
 * URL gets `true` synchronously on the first call — no flicker, no
 * spinner gate, no re-fetch. New URLs trigger a preload and the hook
 * re-renders when the bytes are ready.
 */
export function useImageReady(src: string | null | undefined): boolean {
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!src) return;
    if (readyUrls.has(src)) return; // already cached, nothing to do

    let cancelled = false;
    preloadImage(src).then(() => {
      if (!cancelled) forceRender((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return !!src && readyUrls.has(src);
}

/**
 * Image renderer for the central map preview shown on every draft
 * phase. The browser paints it progressively as bytes arrive — no
 * spinner gate, so we can never get stuck on "Loading..." if a load
 * event was missed.
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
        key={src}
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

/**
 * Page-level map backdrop. Reads from the shared image cache so once
 * the picked map's artwork has been decoded once, it stays painted
 * across every phase transition (BAN -> PLAYING -> END_MAP -> ...)
 * with no flicker and no re-fetch.
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
