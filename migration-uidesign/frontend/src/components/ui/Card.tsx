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
          "rounded-lg relative overflow-hidden",
          {
            "bg-card": variant === "default",
            "bg-surface-elevated shadow-lg shadow-black/20": variant === "elevated",
            "bg-card border border-border hover:border-border/80 transition-colors": variant === "bordered",
            "bg-card border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:to-accent/5 before:pointer-events-none": variant === "gradient",
            "bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/50 shadow-lg shadow-primary/20 hover:border-primary/70 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300": variant === "featured",
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
    className={clsx("text-lg font-semibold text-foreground", className)}
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
