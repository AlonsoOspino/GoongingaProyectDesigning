import type { Metadata } from "next";
import { PlayerPage } from "@/features/networkFeud/PlayerPage";

export const metadata: Metadata = { title: "Play Family Feud" };
export default function NetworkFeudGameRoute() { return <PlayerPage />; }
