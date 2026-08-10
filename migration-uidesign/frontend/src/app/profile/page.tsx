"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, UserRound } from "lucide-react";
import { useSession } from "@/features/session/SessionProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getMemberProfileById, updateMemberProfile } from "@/lib/api/auth";

export default function ProfilePage() {
  const router = useRouter();
  const { token, user, isHydrated } = useSession();
  const [form, setForm] = useState({ nickname: "", profilePic: "", obsWebsocketUrl: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (!token || !user) { router.replace("/login?next=/profile"); return; }
    getMemberProfileById(user.id, token).then((profile) => setForm({
      nickname: profile.nickname || "",
      profilePic: profile.profilePic || "",
      obsWebsocketUrl: profile.obsWebsocketUrl || "",
    })).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load profile."));
  }, [isHydrated, router, token, user]);

  const save = async () => {
    if (!token || !user) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateMemberProfile(token, user.id, {
        nickname: form.nickname.trim(),
        profilePic: form.profilePic.trim() || undefined,
        obsWebsocketUrl: form.obsWebsocketUrl.trim() || null,
      });
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update profile.");
    } finally { setSaving(false); }
  };

  if (!user) return null;
  return <main className="ow-section"><div className="ow-container max-w-3xl"><span className="ow-eyebrow"><UserRound size={15} /> Network Member</span><h1 className="mt-3 font-display text-6xl uppercase">Your profile</h1><div className="ow-panel mt-7 grid gap-6 p-6 md:grid-cols-[100px_1fr]"><Avatar size="xl" className="h-24 w-24" src={form.profilePic || user.profilePic || undefined} fallback={form.nickname || user.nickname} /><div className="grid gap-4"><Input label="Display name" value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /><Input label="Profile image URL" value={form.profilePic} onChange={(event) => setForm({ ...form, profilePic: event.target.value })} /><Input label="OBS WebSocket URL" value={form.obsWebsocketUrl} onChange={(event) => setForm({ ...form, obsWebsocketUrl: event.target.value })} placeholder="Optional" />{message && <p className="text-sm text-muted">{message}</p>}<Button onClick={save} isLoading={saving} className="w-fit"><Save size={17} /> Save profile</Button></div></div></div></main>;
}
