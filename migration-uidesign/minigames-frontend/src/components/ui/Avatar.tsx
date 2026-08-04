"use client";

import { forwardRef, useState, type ImgHTMLAttributes } from "react";
import { clsx } from "clsx";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "size"> {
  size?: AvatarSize;
  fallback?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
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
          "relative inline-flex items-center justify-center rounded-full bg-surface-elevated overflow-hidden",
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
          <span className="font-medium text-muted">{initials}</span>
        )}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";
