"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/features/session/SessionProvider";
import { getCurrentTournament } from "@/lib/api/admin";
import type { Tournament } from "@/lib/api/admin";

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function TournamentTimer() {
  const { isHydrated } = useSession();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;
    
    loadTournament();
  }, [isHydrated]);

  useEffect(() => {
    if (!tournament || tournament.state !== "SCHEDULED") {
      setLoading(false);
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const targetDate = new Date(tournament.startDate).getTime();
      const distance = targetDate - now;

      if (distance <= 0) {
        setTimeRemaining(null);
        setLoading(false);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds });
      setLoading(false);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [tournament]);

  async function loadTournament() {
    try {
      const data = await getCurrentTournament();
      setTournament(data);
    } catch {
      setLoading(false);
    }
  }

  if (!isHydrated || loading || !tournament || tournament.state !== "SCHEDULED" || !timeRemaining) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white py-3 px-4 text-center">
      <div className="container mx-auto">
        <p className="text-sm font-medium mb-2">Tournament Starting In:</p>
        <div className="flex justify-center items-center gap-2 text-lg font-bold">
          <div className="flex flex-col items-center">
            <span className="text-2xl">{timeRemaining.days}</span>
            <span className="text-xs uppercase">Days</span>
          </div>
          <span>:</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl">{String(timeRemaining.hours).padStart(2, "0")}</span>
            <span className="text-xs uppercase">Hours</span>
          </div>
          <span>:</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl">{String(timeRemaining.minutes).padStart(2, "0")}</span>
            <span className="text-xs uppercase">Mins</span>
          </div>
          <span>:</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl">{String(timeRemaining.seconds).padStart(2, "0")}</span>
            <span className="text-xs uppercase">Secs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
