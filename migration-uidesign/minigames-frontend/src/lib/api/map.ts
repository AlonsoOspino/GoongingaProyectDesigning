import { apiRequest } from "@/lib/api/client";
import type { GameMap } from "@/lib/api/types";

export async function getMaps() {
  return apiRequest<GameMap[]>("/map");
}
