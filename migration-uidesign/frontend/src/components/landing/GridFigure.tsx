"use client";

import styles from "./landing.module.css";

interface Props {
  src: string;
  alt: string;
  width: number;
  height: number;
  motion?: boolean;
  eager?: boolean;
  imgClassName?: string;
  className?: string;
}

export default function GridFigure({
  src,
  alt,
  width,
  height,
  motion = true,
  eager = false,
  imgClassName,
  className,
}: Props) {
  return (
    <div
      className={`${styles.gridFigure} ${className ?? ""}`}
      data-figure-motion={motion ? "" : undefined}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        className={`${styles.figureImg} ${imgClassName ?? ""}`}
      />
    </div>
  );
}
