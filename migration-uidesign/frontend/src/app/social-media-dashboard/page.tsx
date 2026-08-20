"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Gamepad2, Images, LayoutDashboard, RadioTower, Trophy } from "lucide-react";
import { AnnouncementModeControl } from "@/announcements/AnnouncementModeControl";
import { ManagerDashboardFrame } from "@/components/dashboard/ManagerDashboardFrame";
import { readNetworkSessionUser, type NetworkSessionUser } from "@/features/networkSession/storage";
import { JeopardyDashboard } from "@/minigames/JeopardyDashboard";
import styles from "./social-dashboard.module.css";

type Workspace = "league" | "minigames" | "stream";

const workspaces = [
  { id: "league" as const, label: "GGL", icon: Trophy },
  { id: "minigames" as const, label: "Minigames", icon: Gamepad2 },
  { id: "stream" as const, label: "Stream management", icon: RadioTower },
];

const streamTools = [
  { href: "/assets-edition", title: "Overlay assets", copy: "Configure match graphics and the shared leaderboard layout.", icon: Images },
  { href: "/overlay", title: "Overlay routes", copy: "Open the available match, roster, map pool and results outputs.", icon: LayoutDashboard },
];

function ToolLinks({ items }: { items: typeof streamTools }) {
  return (
    <div className={styles.toolGrid}>
      {items.map(({ href, title, copy, icon: Icon }) => (
        <Link href={href} key={href} className={styles.toolLink}>
          <Icon size={24} />
          <span><strong>{title}</strong><small>{copy}</small></span>
          <ExternalLink size={17} />
        </Link>
      ))}
    </div>
  );
}

export default function SocialMediaDashboardPage() {
  const router = useRouter();
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>("league");
  const [user, setUser] = useState<NetworkSessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = readNetworkSessionUser();
    const allowed = current?.roles.some((role) => role === "CASTER" || role === "SOCIAL_MEDIA" || role === "ADMIN");
    if (!current || !allowed) {
      router.replace("/login");
      setReady(true);
      return;
    }
    const hasProductionAccess = current.roles.some((role) => role === "SOCIAL_MEDIA" || role === "ADMIN");
    setActiveWorkspace(hasProductionAccess ? "league" : "minigames");
    setUser(current);
    setReady(true);
  }, [router]);

  if (!ready || !user) {
    return <main className={styles.loading}>Loading dashboard...</main>;
  }

  const canManageProduction = user.roles.some((role) => role === "SOCIAL_MEDIA" || role === "ADMIN");
  const visibleWorkspaces = canManageProduction ? workspaces : workspaces.filter((workspace) => workspace.id === "minigames");
  const dashboardTitle = canManageProduction ? "Production control" : "Jeopardy control";
  const dashboardCopy = canManageProduction
    ? "League operations, minigames and stream outputs."
    : "Open an existing Jeopardy game and control questions, scores and stream order.";

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <div className="ow-container">
          <span className={styles.kicker}>Game and production control</span>
          <div className={styles.titleRow}>
            <div><h1>{dashboardTitle}</h1><p>{dashboardCopy}</p></div>
            <span className={styles.operator}>{user.username}</span>
          </div>
          <nav className={styles.workspaceTabs} aria-label="Dashboard areas">
            {visibleWorkspaces.map(({ id, label, icon: Icon }) => (
              <button type="button" key={id} onClick={() => setActiveWorkspace(id)} className={activeWorkspace === id ? styles.workspaceActive : ""}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className={styles.workspaceBody}>
        {activeWorkspace === "league" ? (
          <>
            <div className="ow-container"><AnnouncementModeControl /></div>
            <ManagerDashboardFrame />
          </>
        ) : null}

        {activeWorkspace === "minigames" ? (
          <section className="ow-container">
            <JeopardyDashboard canAdminister={canManageProduction} />
          </section>
        ) : null}

        {activeWorkspace === "stream" ? (
          <section className="ow-container">
            <div className={styles.sectionHeading}><span className={styles.kicker}>Stream management</span><h2>Broadcast tools</h2><p>Manage visual assets and open the outputs used in OBS.</p></div>
            <ToolLinks items={streamTools} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
