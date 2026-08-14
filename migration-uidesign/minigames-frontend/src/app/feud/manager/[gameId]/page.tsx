import type { Metadata } from "next";
import { ManagerPage } from "@/features/networkFeud/ManagerPage";

export const metadata: Metadata = { title: "Family Feud Manager" };
export default function NetworkFeudManagerRoute() { return <ManagerPage />; }
