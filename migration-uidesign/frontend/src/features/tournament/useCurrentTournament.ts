"use client";

import { useEffect, useState } from "react";
import { getCurrentTournament, type Tournament } from "@/lib/api/admin";

export function useCurrentTournament() {
  const [tournament, setTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    let mounted = true;
    getCurrentTournament({ cache: "no-store" })
      .then((current) => { if (mounted) setTournament(current); })
      .catch(() => { if (mounted) setTournament(null); });
    return () => { mounted = false; };
  }, []);

  return tournament;
}
