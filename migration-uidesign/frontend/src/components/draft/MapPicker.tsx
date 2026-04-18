"use client";

import { clsx } from "clsx";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { GameMap, MapType } from "@/lib/api/types";

interface MapPickerProps {
  availableMaps: GameMap[];
  pickedMapIds: number[];
  allowedTypes?: MapType[];
  onSelectMap?: (mapId: number) => void;
  disabled?: boolean;
  isMyTurn?: boolean;
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
}: MapPickerProps) {
  // Group maps by type
  const mapsByType = availableMaps.reduce((acc, map) => {
    if (!acc[map.type]) {
      acc[map.type] = [];
    }
    acc[map.type].push(map);
    return acc;
  }, {} as Record<MapType, GameMap[]>);

  return (
    <Card variant="bordered" className="h-full">
      <CardHeader>
        <CardTitle>Available Maps</CardTitle>
      </CardHeader>
      <CardContent className="max-h-[500px] overflow-y-auto">
        {Object.entries(mapsByType).map(([type, maps]) => {
          const isTypeAllowed = !allowedTypes || allowedTypes.includes(type as MapType);

          return (
            <div key={type} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={mapTypeColors[type as MapType]}>{type}</Badge>
                {!isTypeAllowed && (
                  <span className="text-xs text-muted">(Not available this round)</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {maps.map((map) => {
                  const isPicked = pickedMapIds.includes(map.id);
                  const isAvailable = isTypeAllowed && !isPicked && !disabled;

                  return (
                    <button
                      key={map.id}
                      type="button"
                      onClick={() => isAvailable && onSelectMap?.(map.id)}
                      disabled={!isAvailable}
                      className={clsx(
                        "relative rounded-lg overflow-hidden border transition-all",
                        isAvailable && isMyTurn
                          ? "border-primary/50 hover:border-primary cursor-pointer"
                          : "border-border",
                        isPicked && "opacity-40",
                        !isAvailable && "cursor-not-allowed"
                      )}
                    >
                      {/* Map Image */}
                      <div className="aspect-video bg-surface-elevated">
                        {map.imgPath ? (
                          <img
                            src={map.imgPath}
                            alt={map.description}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-xs text-muted">No Image</span>
                          </div>
                        )}
                      </div>

                      {/* Map Info */}
                      <div className="p-2 bg-surface">
                        <p className="text-xs font-medium text-foreground truncate">
                          {map.description}
                        </p>
                      </div>

                      {/* Picked Overlay */}
                      {isPicked && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Badge variant="default">Picked</Badge>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
