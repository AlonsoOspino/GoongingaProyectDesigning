export type MediaTone = "sage" | "dusty-blue" | "warm-stone" | "muted-burgundy" | "pale-beige";

type MediaPlaceholderProps = {
  label: string;
  tone: MediaTone;
  className?: string;
};

export function MediaPlaceholder({ label, tone, className = "" }: MediaPlaceholderProps) {
  return (
    <div
      className={`ggl-media ggl-media--${tone} ${className}`}
      role="img"
      aria-label={label}
    >
      <span>{label}</span>
    </div>
  );
}
