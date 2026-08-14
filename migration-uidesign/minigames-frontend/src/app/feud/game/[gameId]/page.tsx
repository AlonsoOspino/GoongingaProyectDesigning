import type { Metadata } from "next";
import { PlayerPage } from "@/features/networkFeud/PlayerPage";

export const metadata: Metadata = { title: "Play Network Feud" };
export default function NetworkFeudGameRoute() { return <PlayerPage />; }
