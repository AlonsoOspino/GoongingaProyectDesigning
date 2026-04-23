"use client";

import { clsx } from "clsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { GameMap, MapType } from "@/lib/api/types";
import { resolveMapImageUrl } from "@/lib/assetUrls";

interface MapPickerProps {
  availableMaps: GameMap[];
  pickedMapIds: number[];
  allowedTypes?: MapType[];
  onSelectMap?: (mapId: number) => void;
  disabled?: boolean;
  isMyTurn?: boolean;
  selectedMapId?: number | null;
}

const mapTypeColors: Record<MapType, string> = {
  CONTROL: "bg-primary/20 text-primary",
  HYBRID: "bg-success/20 text-success",
  PAYLOAD: "bg-accent/20 text-accent",
  PUSH: "bg-warning/20 text-warning",
  FLASHPOINT: "bg-danger/20 text-danger",
};

export function MapPicker({
  availableMaps,
  pickedMapIds,
  allowedTypes,
  onSelectMap,
  disabled,
  isMyTurn,
  selectedMapId,
}: MapPickerProps) {
  return (
    <Card variant="featured" className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Available Maps</CardTitle>
          {isMyTurn && (
            <Badge variant="success" className="animate-pulse-glow">Your Turn</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="max-h-[500px] overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {availableMaps.map((map) => {
            const isPicked = pickedMapIds.includes(map.id);
            const isTypeAllowed = !allowedTypes || allowedTypes.includes(map.type);
            const isSelected = map.id === selectedMapId;
            const isAvailable = isTypeAllowed && !isPicked && !disabled;

            return (
              <button
                key={map.id}
                type="button"
                onClick={() => isAvailable && onSelectMap?.(map.id)}
                disabled={!isAvailable}
                className={clsx(
                  "relative rounded-lg overflow-hidden border-2 transition-all group",
                  isPicked
                    ? "border-border opacity-40 grayscale cursor-not-allowed"
                    : isSelected
                    ? "border-primary ring-2 ring-primary/30"
                    : isAvailable && isMyTurn
                    ? "border-border hover:border-primary cursor-pointer hover:scale-[1.02]"
                    : "border-border",
                  !isAvailable && "cursor-not-allowed"
                )}
              >
                {/* Map Image */}
                <div className="aspect-video bg-surface-elevated">
                  {map.imgPath ? (
                    <img
                      src={resolveMapImageUrl(map.imgPath)}
                      alt={map.description}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-lg font-bold text-muted">{map.description.charAt(0)}</span>
                    </div>
                  )}
                </div>

                {/* Map Info */}
                <div className="p-2 bg-background">
                  <p className="text-xs font-medium text-foreground truncate">
                    {map.description}
                  </p>
                  <Badge className={clsx("text-[10px] mt-1", mapTypeColors[map.type])}>
                    {map.type}
                  </Badge>
                </div>

                {/* Picked Overlay */}
                {isPicked && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <span className="text-xs text-muted font-semibold uppercase">Picked</span>
                  </div>
                )}

                {/* Selected Badge */}
                {isSelected && (
                  <div className="absolute top-1 right-1">
                    <Badge variant="success" className="text-[10px]">Selected</Badge>
                  </div>
                )}

                {/* Not Allowed Overlay */}
                {!isTypeAllowed && !isPicked && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <span className="text-[10px] text-muted">Not available</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
