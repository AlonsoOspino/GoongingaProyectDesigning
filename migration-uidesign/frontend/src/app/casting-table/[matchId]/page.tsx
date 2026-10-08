"use client";

import { useParams } from "next/navigation";
import { CastingTable } from "@/components/casting/CastingTable";

export default function CastingTablePage() {
  const params = useParams<{ matchId: string }>();
  return <CastingTable matchId={Number(params.matchId)} />;
}
