"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getDraftByMatchId, getTeams, type DraftState, type Team } from "@/lib/api";
import { BroadcastFrame } from "@/components/casting/BroadcastFrame";
import { HeroBansBroadcast } from "@/components/casting/HeroBansBroadcast";
import { MapPoolOverlay } from "@/app/overlay/components/MapPoolOverlay";
import { WincardsOverlay } from "@/app/overlay/components/WincardsOverlay";
import { loadHeroVideos, type HeroVideoManifest } from "@/lib/casting/model";
import styles from "@/components/casting/broadcast.module.css";

export default function CastingOverlayPage() {
  const params = useParams<{ matchId: string }>();
  const search = useSearchParams();
  const matchId = Number(params.matchId);
  const view = search.get("view") || "waiting";
  const key = search.get("key") || "";
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [manifest, setManifest] = useState<HeroVideoManifest>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (view !== "hero-bans" || !Number.isInteger(matchId) || matchId <= 0) return;
    const abort = new AbortController();
    let busy = false;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const state = await getDraftByMatchId(matchId, { key });
        if (!abort.signal.aborted) { setDraft(state); setError(""); }
      } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load broadcast."); }
      finally { busy = false; }
    };
    void getTeams().then(value => { if (!abort.signal.aborted) setTeams(value); }).catch(() => {});
    void loadHeroVideos(abort.signal).then(setManifest).catch(() => {});
    void poll();
    const timer = window.setInterval(() => void poll(), 1800);
    return () => { abort.abort(); window.clearInterval(timer); };
  }, [matchId, key, view]);
  let content;
  if (!Number.isInteger(matchId) || matchId <= 0) content = <div className={styles.message}><strong>Invalid match</strong></div>;
  else if (view === "map-pool") content = <MapPoolOverlay matchId={matchId} variant="clean" />;
  else if (view === "winner") content = <WincardsOverlay matchId={matchId} />;
  else if (view === "hero-bans") content = draft ? <HeroBansBroadcast draft={draft} teams={teams} manifest={manifest} /> : <div className={styles.message}><strong>Hero bans</strong><p>{error || "Loading selected map and bans…"}</p></div>;
  else content = <iframe title="Live draft broadcast" className={styles.embedded} src={`/draft-table/${matchId}?broadcast=1${key ? `&key=${encodeURIComponent(key)}` : ""}`} />;
  return <BroadcastFrame>{content}</BroadcastFrame>;
}
