"use client";

import { clsx } from "clsx";

interface DraftTimerProps {
  timeRemaining: number;
  phase: string;
  currentTeam?: string;
}

export function DraftTimer({ timeRemaining, phase, currentTeam }: DraftTimerProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isUrgent = timeRemaining <= 10;
  const isWarning = timeRemaining <= 20 && timeRemaining > 10;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Phase Label */}
      <div className="text-sm text-muted uppercase tracking-wider">
        {phase.replace(/_/g, " ")}
      </div>

      {/* Timer */}
      <div
        className={clsx(
          "text-5xl font-bold font-mono transition-colors",
          isUrgent && "text-danger animate-pulse",
          isWarning && "text-warning",
          !isUrgent && !isWarning && "text-foreground"
        )}
      >
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>

      {/* Current Team */}
      {currentTeam && (
        <div className="text-sm text-muted">
          <span className="text-foreground font-medium">{currentTeam}</span>
          {" is picking"}
        </div>
      )}
    </div>
  );
}
