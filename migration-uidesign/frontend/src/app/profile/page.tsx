"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { useSession } from "@/features/session/SessionProvider";
import {
  readNetworkSessionUser,
  type NetworkSessionUser,
} from "@/features/networkSession/storage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getMemberProfileById, updateMemberProfile } from "@/lib/api/auth";
import styles from "./profile.module.css";

export default function ProfilePage() {
  const router = useRouter();
  const { token, user, isHydrated } = useSession();
  const [networkUser, setNetworkUser] = useState<NetworkSessionUser | null>(null);
  const [form, setForm] = useState({ nickname: "", profilePic: "", obsWebsocketUrl: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNetworkUser(readNetworkSessionUser());
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!token || !user) {
      router.replace("/login?next=/profile");
      return;
    }
    getMemberProfileById(user.id, token)
      .then((profile) =>
        setForm({
          nickname: profile.nickname || "",
          profilePic: profile.profilePic || "",
          obsWebsocketUrl: profile.obsWebsocketUrl || "",
        })
      )
      .catch((error) => {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : "Unable to load profile.");
      });
  }, [isHydrated, router, token, user]);

  const save = async () => {
    if (!token || !user) return;
    setSaving(true);
    setMessage(null);
    setFailed(false);
    try {
      await updateMemberProfile(token, user.id, {
        nickname: form.nickname.trim(),
        profilePic: form.profilePic.trim() || undefined,
        obsWebsocketUrl: form.obsWebsocketUrl.trim() || null,
      });
      setMessage("Profile updated.");
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const displayName = form.nickname || networkUser?.username || user.nickname;
  const avatarSrc = form.profilePic || networkUser?.avatarUrl || user.profilePic || "";
  const initial = (displayName || "?").charAt(0).toUpperCase();
  // Discord decides these, so they are shown rather than edited.
  const roles = networkUser?.roles ?? [];

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.identity}>
          <div className={styles.avatarFrame}>
            {avatarSrc ? (
              <img className={styles.avatarImage} src={avatarSrc} alt="" />
            ) : (
              <span className={styles.avatarFallback}>{initial}</span>
            )}
          </div>

          <div className={styles.identityText}>
            <span className={styles.eyebrow}>Network member</span>
            <h1 className={styles.name}>{displayName}</h1>
            {roles.length > 0 ? (
              <div className={styles.roles}>
                {roles.map((role) => (
                  <span
                    key={role}
                    className={`${styles.roleChip} ${
                      role === "ADMIN" || role === "DEVELOPER" ? styles.roleChipPrimary : ""
                    }`}
                  >
                    {role.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>How you appear</h2>
            <p className={styles.panelNote}>
              Your roles and Discord identity are managed in the server. These are the parts you
              control.
            </p>
          </div>

          <div className={styles.fields}>
            <Input
              label="Display name"
              value={form.nickname}
              onChange={(event) => setForm({ ...form, nickname: event.target.value })}
            />
            <Input
              label="Profile image URL"
              value={form.profilePic}
              onChange={(event) => setForm({ ...form, profilePic: event.target.value })}
              placeholder="Leave empty to use your Discord avatar"
            />
            <div className={styles.fieldWide}>
              <Input
                label="OBS WebSocket URL"
                value={form.obsWebsocketUrl}
                onChange={(event) => setForm({ ...form, obsWebsocketUrl: event.target.value })}
                placeholder="Optional. Used to drive overlays from your own OBS."
              />
            </div>
          </div>

          <div className={styles.footer}>
            <Button onClick={save} isLoading={saving} className="w-fit">
              <Save size={17} /> Save profile
            </Button>
            {message && (
              <p className={`${styles.message} ${failed ? styles.messageError : ""}`}>{message}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
