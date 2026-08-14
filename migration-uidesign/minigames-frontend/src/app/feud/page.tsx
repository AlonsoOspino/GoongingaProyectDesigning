import type { Metadata } from "next";
import { LandingPage } from "@/features/networkFeud/LandingPage";

export const metadata: Metadata = { title: "Network Feud", description: "Join or host a live Network Feud match." };
export const dynamic = "force-dynamic";

export default function NetworkFeudPage() { return <LandingPage />; }
