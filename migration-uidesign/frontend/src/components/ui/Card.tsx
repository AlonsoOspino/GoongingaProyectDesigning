import { forwardRef, type HTMLAttributes } from "react";
import { clsx } from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "bordered" | "gradient" | "featured";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "rounded-md relative overflow-hidden",
          {
            "bg-surface-1 border border-border-subtle": variant === "default",
            "bg-surface-2 border border-border-subtle shadow-lg shadow-surface-inset/20": variant === "elevated",
            "bg-surface-1 border border-border hover:border-border-strong transition-colors duration-fast ease-out": variant === "bordered",
            "bg-surface-2 border border-border": variant === "gradient",
            "bg-brand-deep border border-brand shadow-lg shadow-surface-inset/20 hover:border-brand-bright transition-all duration-base ease-out": variant === "featured",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx("px-4 py-3 border-b border-border", className)}
    {...props}
  />
));

CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={clsx("text-body-l font-semibold text-text-primary", className)}
    {...props}
  />
));

CardTitle.displayName = "CardTitle";

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={clsx("p-4", className)} {...props} />
));

CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx("px-4 py-3 border-t border-border", className)}
    {...props}
  />
));

CardFooter.displayName = "CardFooter";
