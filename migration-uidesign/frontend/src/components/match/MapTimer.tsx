import { useMapTimer, formatMapTime } from "@/hooks/useMapTimer";
import { clsx } from "clsx";

interface MapTimerProps {
  mapStartedAt: string | null;
  isPaused: boolean;
  onPauseToggle?: (paused: boolean) => void;
  showPauseButton?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Displays a countdown timer for an active map. Updates every 100ms based on
 * server time. Optionally shows a pause/resume button for managers.
 */
export function MapTimer({
  mapStartedAt,
  isPaused,
  onPauseToggle,
  showPauseButton = false,
  size = "md",
}: MapTimerProps) {
  const { timeLeft, isActive } = useMapTimer(mapStartedAt, isPaused);

  if (!isActive) {
    return null;
  }

  const sizeClasses = {
    sm: "text-sm",
    md: "text-2xl",
    lg: "text-4xl",
  };

  // Warning color when < 30 seconds remaining
  const isWarning = timeLeft < 30 * 1000;

  return (
    <div className="flex items-center gap-3">
      <div
        className={clsx(
          "font-mono font-bold tracking-widest px-4 py-2 rounded-lg",
          sizeClasses[size],
          isWarning
            ? "bg-danger/20 text-danger"
            : "bg-accent/20 text-accent",
        )}
      >
        {formatMapTime(timeLeft)}
      </div>

      {showPauseButton && onPauseToggle && (
        <button
          onClick={() => onPauseToggle(!isPaused)}
          className={clsx(
            "px-3 py-2 rounded-lg font-semibold text-sm transition-colors",
            isPaused
              ? "bg-warning/20 text-warning hover:bg-warning/30"
              : "bg-accent/20 text-accent hover:bg-accent/30",
          )}
        >
          {isPaused ? "Resume" : "Pause"}
        </button>
      )}

      {isPaused && (
        <div className="text-sm text-warning font-medium">
          ⏸️ Paused
        </div>
      )}
    </div>
  );
}
