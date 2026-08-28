export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`otp-brand-mark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M2 12h9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
        <path d="M13.4 4.5v15" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
        <path d="M17 12h5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
      </svg>
    </span>
  );
}
