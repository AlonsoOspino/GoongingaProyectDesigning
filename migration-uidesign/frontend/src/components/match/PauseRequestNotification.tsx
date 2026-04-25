import Image from "next/image";
import { clsx } from "clsx";

interface PauseRequestNotificationProps {
  captainName: string;
  teamName: string;
  avatarUrl?: string;
  onAccept?: () => void;
  onDeny?: () => void;
  isPending?: boolean;
  isManager?: boolean;
}

/**
 * Displays a visual notification that a captain is requesting a pause.
 * Shows the captain's avatar, name, and team. Only managers see pause action buttons.
 */
export function PauseRequestNotification({
  captainName,
  teamName,
  avatarUrl,
  onAccept,
  onDeny,
  isPending = false,
  isManager = false,
}: PauseRequestNotificationProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/50 rounded-lg">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={captainName}
            width={48}
            height={48}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center text-warning font-bold">
            {captainName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{captainName}</p>
        <p className="text-xs text-muted">{teamName}</p>
      </div>

      {/* Request Label */}
      <div className="text-sm font-medium text-warning">
        Requesting pause
      </div>

      {/* Manager Actions */}
      {isManager && (
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onAccept}
            disabled={isPending}
            className={clsx(
              "px-3 py-1 text-sm font-medium rounded transition-colors",
              isPending
                ? "bg-accent/30 text-accent/50 cursor-not-allowed"
                : "bg-accent/20 text-accent hover:bg-accent/30",
            )}
          >
            {isPending ? "..." : "Approve"}
          </button>
          <button
            onClick={onDeny}
            disabled={isPending}
            className={clsx(
              "px-3 py-1 text-sm font-medium rounded transition-colors",
              isPending
                ? "bg-danger/30 text-danger/50 cursor-not-allowed"
                : "bg-danger/20 text-danger hover:bg-danger/30",
            )}
          >
            {isPending ? "..." : "Deny"}
          </button>
        </div>
      )}
    </div>
  );
}
