"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Radio, RefreshCw } from "lucide-react";
import { AnnouncementStudio } from "@/announcements/AnnouncementStudio";
import { readNetworkSessionUser, type NetworkSessionUser } from "@/features/networkSession/storage";
import { getMatches, getTeams, type Match, type Team } from "@/lib/api";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import { canCast } from "@/lib/casting/model";
import styles from "@/components/casting/control-room.module.css";

export default function CastingDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<NetworkSessionUser | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming");
  const load = useCallback(async () => {
    try {
      const [rows, clubs] = await Promise.all([getMatches({ cache: "no-store" }), getTeams()]);
      setMatches(rows); setTeams(clubs); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to load matches."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const current = readNetworkSessionUser();
    if (!current || !canCast(current.roles)) { router.replace("/login?next=/casting-dashboard"); return; }
    setUser(current);
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load, router]);
  const visible = matches.filter(m => filter === "all" || (filter === "live" ? m.status === "ACTIVE" : m.status !== "FINISHED"))
    .sort((a,b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || Date.parse(a.startDate) - Date.parse(b.startDate));
  return <div className={styles.room} data-theme="dark"><div className={styles.container}>
    <header className={styles.dashboardHead}><div><span className={styles.eyebrow}><Radio size={14} /> GOONGINGA · BROADCAST PRODUCTION</span><h1>Casting dashboard</h1><p>Choose your match. Prepare OBS. Run the show.</p></div><span className={styles.operator}>{user?.username || "Production"}</span></header>
    <div className={styles.sectionBar}><div><h2>Match lineup</h2><p>Every match has a draft table ready for its captains.</p></div><div className={styles.inline}><select aria-label="Filter matches" value={filter} onChange={e => setFilter(e.target.value)}><option value="upcoming">Upcoming & live</option><option value="live">Live matches</option><option value="all">All matches</option></select><button className={styles.iconButton} aria-label="Refresh matches" onClick={() => void load()}><RefreshCw size={18} /></button></div></div>
    {error && <p className={styles.error} role="alert">{error}</p>}{loading && <p className={styles.empty}>Loading the match lineup…</p>}{!loading && !visible.length && <p className={styles.empty}>No matches in this lineup.</p>}
    <div className={styles.matchGrid}>{visible.map(match => {
      const a = teams.find(t => t.id === match.teamAId), b = teams.find(t => t.id === match.teamBId);
      return <article key={match.id} className={styles.matchCard}>
        <div className={styles.cardTop}><span className={match.status === "ACTIVE" ? styles.live : styles.muted}>{match.status === "ACTIVE" ? "● LIVE MATCH" : match.status === "FINISHED" ? "COMPLETED" : "SCHEDULED"}</span><span>BO{match.bestOf} · #{match.id}</span></div>
        <div className={styles.versus}>{[a,b].map((team,index) => <div className={styles.club} key={index}><div className={styles.clubLogo}>{team?.logo ? <img src={resolveGenericBackendAsset(team.logo)} alt={`${team.name} logo`} /> : <span>{team?.name.charAt(0) || (index === 0 ? "A" : "B")}</span>}</div><strong>{team?.name || `Team ${index + 1}`}</strong></div>)}<span className={styles.vs}>VS</span></div>
        <div className={styles.cardDetails}><strong>{match.title || (match.semanas ? `Week ${match.semanas}` : "League match")}</strong><time dateTime={match.startDate}>{new Date(match.startDate).toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}</time></div>
        <Link className={styles.primary} href={`/casting-table/${match.id}`}>Start Casting <ArrowUpRight size={18} /></Link>
      </article>;
    })}</div>
    {user?.roles.some(r => r === "ADMIN" || r === "SOCIAL_MEDIA") && <details className={styles.announcements}><summary>Announcements <span>Manage homepage publishing</span></summary><AnnouncementStudio /></details>}
  </div></div>;
}
