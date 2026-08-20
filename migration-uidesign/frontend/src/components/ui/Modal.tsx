"use client";

import { useEffect, useId, useRef, type HTMLAttributes, type ReactNode } from "react";
import { clsx } from "clsx";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusableSelector = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    const frame = window.requestAnimationFrame(() => (focusable()[0] ?? dialog)?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-6 sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-0/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={clsx(
          "relative z-10 w-full max-w-lg bg-surface-1 border border-border rounded-lg shadow-2xl animate-fade-in max-h-[calc(100vh-3rem)] overflow-y-auto",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 id={titleId} className="text-body-l font-semibold text-text-primary">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-sm text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors duration-fast ease-out"
              aria-label="Close modal"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
        {title ? <div className="p-6">{children}</div> : children}
      </div>
    </div>
  );
}

interface ModalSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface ModalTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export function ModalHeader({ children, className, ...props }: ModalSectionProps) {
  return (
    <div
      className={clsx("flex items-center justify-between px-6 py-4 border-b border-border", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ModalTitle({ children, className, ...props }: ModalTitleProps) {
  return (
    <h2 className={clsx("text-body-l font-semibold text-text-primary", className)} {...props}>
      {children}
    </h2>
  );
}

export function ModalContent({ children, className, ...props }: ModalSectionProps) {
  return (
    <div className={clsx("px-6 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function ModalFooter({ children, className, ...props }: ModalSectionProps) {
  return (
    <div className={clsx("flex items-center justify-end gap-2 px-6 py-4 border-t border-border", className)} {...props}>
      {children}
    </div>
  );
}
