"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnnouncementStudio } from "@/announcements/AnnouncementStudio";
import { ManagerDashboardFrame } from "@/components/dashboard/ManagerDashboardFrame";
import { readNetworkSessionUser, type NetworkSessionUser } from "@/features/networkSession/storage";
import styles from "./social-dashboard.module.css";

/*
 * Production control for the league.
 *
 * This used to be three workspaces. Minigames moved to their own site, and the
 * stream tools were links to an overlay-asset editor that is gone and to
 * overlay URLs that OBS now pulls over its websocket. One surface is left, so
 * the tab bar went with them.
 *
 * Access narrowed with it: casters only ever had the minigames workspace here,
 * so the page is now for the people who run league operations.
 */
export default function CastingDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<NetworkSessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = readNetworkSessionUser();
    const allowed = current?.roles.some((role) => role === "SOCIAL_MEDIA" || role === "ADMIN");
    if (!current || !allowed) {
      router.replace("/login");
      setReady(true);
      return;
    }
    setUser(current);
    setReady(true);
  }, [router]);

  if (!ready || !user) {
    return <main className={styles.loading}>Loading dashboard...</main>;
  }

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <div className="ow-container">
          <span className={styles.kicker}>Production control</span>
          <div className={styles.titleRow}>
            <div>
              <h1>Casting Dashboard</h1>
              <p>Publish announcements and run league operations.</p>
            </div>
            <span className={styles.operator}>{user.username}</span>
          </div>
        </div>
      </header>

      {/* Two jobs, named. Before this they were stacked with nothing to say
          where one ended and the next began. */}
      <div className={styles.workspaceBody}>
        <section className="ow-container">
          <div className={styles.areaHead}>
            <span className={styles.areaIndex}>01</span>
            <div>
              <h2 className={styles.areaTitle}>Announcements</h2>
              <p className={styles.areaNote}>What the homepage is telling the community right now.</p>
            </div>
          </div>
          <AnnouncementStudio />
        </section>

        <section className={styles.areaBlock}>
          <div className="ow-container">
            <div className={styles.areaHead}>
              <span className={styles.areaIndex}>02</span>
              <div>
                <h2 className={styles.areaTitle}>League operations</h2>
                <p className={styles.areaNote}>Matches, draft tables and results.</p>
              </div>
            </div>
          </div>
          <ManagerDashboardFrame />
        </section>
      </div>
    </main>
  );
}
