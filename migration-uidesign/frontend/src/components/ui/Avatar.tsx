"use client";

import { forwardRef, useState, type ImgHTMLAttributes } from "react";
import { clsx } from "clsx";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "size"> {
  size?: AvatarSize;
  fallback?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-label",
  md: "w-10 h-10 text-body-s",
  lg: "w-12 h-12 text-body",
  xl: "w-16 h-16 text-body-l",
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = "md", src, alt, fallback, ...props }, ref) => {
    const [hasError, setHasError] = useState(false);

    const initials = fallback
      ? fallback
          .split(" ")
          .map((word) => word[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "?";

    return (
      <div
        ref={ref}
        className={clsx(
          "relative inline-flex items-center justify-center rounded-full bg-surface-2 overflow-hidden",
          sizeStyles[size],
          className
        )}
      >
        {src && !hasError ? (
          <img
            src={src}
            alt={alt || "Avatar"}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
            {...props}
          />
        ) : (
          <span className="font-medium text-text-muted">{initials}</span>
        )}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";
