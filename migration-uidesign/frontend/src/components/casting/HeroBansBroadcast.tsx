"use client";

import { useEffect, useState } from "react";
import type { DraftState, Hero, Team } from "@/lib/api/types";
import { resolveGenericBackendAsset, resolveHeroImageUrl, resolveMapImageUrl } from "@/lib/assetUrls";
import { currentMapNumber, heroVideo, type HeroVideoManifest } from "@/lib/casting/model";
import styles from "./broadcast.module.css";

function HeroLoop({ hero, manifest }: { hero?: Hero; manifest: HeroVideoManifest }) {
  const video = hero ? heroVideo(manifest, hero) : null;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setFailed(false); setReady(false); }, [video?.url]);
  return <div className={styles.heroSlot}>
    {hero && (!video || failed || !ready) && <img className={styles.heroStill} src={resolveHeroImageUrl(hero.imgPath)} alt="" />}
    {video && !failed && <video className={styles.heroVideo} src={video.url} style={{ objectPosition: video.objectPosition, opacity:ready ? 1 : 0 }} autoPlay muted loop playsInline onLoadedData={() => setReady(true)} onError={() => setFailed(true)} />}
    <div className={styles.heroCaption}><span>BANNED</span><strong>{hero?.name || "No ban"}</strong></div>
  </div>;
}

export function HeroBansBroadcast({ draft, teams, manifest }: { draft: DraftState; teams: Team[]; manifest: HeroVideoManifest }) {
  const number = currentMapNumber(draft);
  const latestPick = draft.actions.filter(a => a.action === "PICK").sort((a,b) => b.gameNumber - a.gameNumber || b.order - a.order)[0];
  const displayNumber = draft.currentMapId ? number : (latestPick?.gameNumber ?? number);
  const map = draft.allMaps?.find(m => m.id === (draft.currentMapId ?? latestPick?.value));
  return <div className={styles.bansStage}>
    {map && <img className={styles.mapBackground} src={resolveMapImageUrl(map.imgPath)} alt="" />}
    <div className={styles.shade} />
    <header className={styles.broadcastHead}><span>GOONGINGA LEAGUE · HERO BANS</span><strong>MAP {displayNumber} · {map?.description || "Selected map"}</strong></header>
    <div className={styles.sides}>{[draft.match.teamAId, draft.match.teamBId].map((teamId, index) => {
      const team = teams.find(t => t.id === teamId);
      const bans = draft.actions.filter(a => a.action === "BAN" && a.gameNumber === displayNumber && a.teamId === teamId).sort((a,b) => a.order - b.order).slice(0, 2);
      return <section className={styles.teamSide} key={teamId} data-side={index}>
        <div className={styles.teamHead}>{team?.logo && <img src={resolveGenericBackendAsset(team.logo)} alt="" />}<strong>{team?.name || `Team ${index + 1}`}</strong></div>
        <div className={styles.heroes}>{[0, 1].map(slot => <HeroLoop key={slot} hero={draft.heroes?.find(h => h.id === bans[slot]?.value)} manifest={manifest} />)}</div>
      </section>;
    })}</div>
    <footer className={styles.broadcastFoot}><span>THE NEXT MAP IS UP</span><strong>{draft.match.mapWinsTeamA} — {draft.match.mapWinsTeamB}</strong><span>BEST OF {draft.match.bestOf}</span></footer>
  </div>;
}
