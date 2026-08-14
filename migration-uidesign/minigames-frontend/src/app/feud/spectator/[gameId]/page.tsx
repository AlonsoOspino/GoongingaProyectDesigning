import type { Metadata } from "next";
import { SpectatorPage } from "@/features/networkFeud/SpectatorPage";

export const metadata: Metadata = { title: "Network Feud Broadcast", robots: { index: false, follow: false } };
export default function NetworkFeudSpectatorRoute() { return <SpectatorPage />; }
