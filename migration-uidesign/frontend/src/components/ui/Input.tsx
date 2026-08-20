import { forwardRef, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-body-s font-medium text-text-primary mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full px-3 py-2 bg-surface-inset border border-border rounded-sm text-text-primary placeholder:text-text-secondary",
            "focus:outline-none focus:ring-2 focus:ring-brand-bright focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-danger focus:ring-danger",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-body-s text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
