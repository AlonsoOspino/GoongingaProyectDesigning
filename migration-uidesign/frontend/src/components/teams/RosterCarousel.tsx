"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const AUTO_ROTATE_MS = 6000;

export interface RosterCarouselItem {
  id: number;
  name: string;
  rosterSrc: string;
}

interface RosterCarouselProps {
  items: RosterCarouselItem[];
  shouldStretchSingleRoster?: boolean;
}

export function RosterCarousel({ items, shouldStretchSingleRoster = false }: RosterCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, AUTO_ROTATE_MS);

    return () => clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, items.length]);

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted">
        <p>No roster images available</p>
      </div>
    );
  }

  const activeItem = items[activeIndex] ?? items[0];
  const rosterIsStretched = shouldStretchSingleRoster && items.length === 1;

  return (
    <div className={`${rosterIsStretched ? "flex-1" : ""} flex flex-col w-full`}>
      <Link
        key={activeItem.id}
        href={`/teams/${activeItem.id}`}
        className={`group block w-full animate-cascade-in ${rosterIsStretched ? "flex-1" : ""}`}
      >
        <div className={`relative w-full overflow-hidden rounded-xl border border-border/60 bg-surface/40 transition-transform group-hover:-translate-y-1 ${rosterIsStretched ? "h-full" : ""}`}>
          <div className={`relative w-full ${rosterIsStretched ? "h-full min-h-[25rem]" : "h-72 md:h-80 lg:h-96"}`}>
            <Image
              src={activeItem.rosterSrc}
              alt={`${activeItem.name} roster`}
              fill
              className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/25 to-transparent" />
          </div>
          <div className="absolute inset-0 p-4 flex items-end">
            <div>
              <p className="text-sm text-muted">Roster</p>
              <p className="text-lg font-semibold text-foreground">{activeItem.name}</p>
            </div>
          </div>
        </div>
      </Link>

      {items.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show ${item.name} roster`}
              aria-pressed={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={`h-2 w-2 rounded-full transition-all ${index === activeIndex ? "bg-primary" : "bg-muted-foreground/40 hover:bg-muted-foreground/70"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
