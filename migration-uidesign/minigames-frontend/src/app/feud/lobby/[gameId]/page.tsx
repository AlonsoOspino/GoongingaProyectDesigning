import type { Metadata } from "next";
import { LobbyPage } from "@/features/networkFeud/LobbyPage";

export const metadata: Metadata = { title: "Family Feud Captain" };
export default function NetworkFeudLobbyRoute() { return <LobbyPage />; }
