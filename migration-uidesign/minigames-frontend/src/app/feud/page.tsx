import type { Metadata } from "next";
import { LandingPage } from "@/features/networkFeud/LandingPage";

export const metadata: Metadata = { title: "Family Feud", description: "Create or join a live Family Feud game." };
export const dynamic = "force-dynamic";

export default function NetworkFeudPage() { return <LandingPage />; }
