import type { Metadata } from "next";
import { LobbyPage } from "@/features/networkFeud/LobbyPage";

export const metadata: Metadata = { title: "Network Feud Lobby" };
export default function NetworkFeudLobbyRoute() { return <LobbyPage />; }
