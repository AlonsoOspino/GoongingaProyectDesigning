"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/features/session/SessionProvider";
import { getMemberProfileById, updateMemberProfile } from "@/lib/api/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ProfilePage() {
  const router = useRouter();
  const { isHydrated, isAuthenticated, user, token, setSession } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    nickname: "",
    user: "",
    password: "",
    profilePic: "",
    rank: "0",
  });

  useEffect(() => {
    async function loadProfile() {
      if (!isAuthenticated || !user?.id) {
        setLoading(false);
        return;
      }

      try {
        const profile = await getMemberProfileById(user.id);
        setForm({
          nickname: profile.nickname || "",
          user: profile.user || "",
          password: "",
          profilePic: profile.profilePic || "",
          rank: String(profile.rank ?? 0),
        });
      } catch (err: any) {
        setError(err?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    if (isHydrated) {
      loadProfile();
    }
  }, [isHydrated, isAuthenticated, user?.id]);

  const handleSave = async () => {
    if (!token || !user?.id) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const rankNumber = Number(form.rank);
      const payload = {
        nickname: form.nickname.trim() || undefined,
        user: form.user.trim() || undefined,
        password: form.password.trim() || undefined,
        profilePic: form.profilePic.trim() || undefined,
        rank: Number.isFinite(rankNumber) ? rankNumber : undefined,
      };

      const updated = await updateMemberProfile(token, user.id, payload);

      setSession(token, {
        id: updated.id,
        nickname: updated.nickname,
        role: updated.role,
        teamId: updated.teamId,
        profilePic: updated.profilePic ?? null,
      });

      setForm((prev) => ({ ...prev, password: "" }));
      setSuccess("Profile updated successfully");
    } catch (err: any) {
      setError(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (!isHydrated || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-3 h-10 w-56" />
        <Skeleton className="mb-8 h-5 w-80" variant="text" />
        <Skeleton className="h-[520px] rounded-2xl" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card variant="featured">
          <CardContent className="py-12 text-center">
            <h2 className="mb-3 text-xl font-semibold text-foreground">Sign in required</h2>
            <p className="mb-5 text-muted">You need to log in to manage your profile.</p>
            <Link href="/login">
              <Button>Go to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Back to Home
        </Link>
      </div>

      <Card variant="featured">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>My Profile</CardTitle>
              <p className="mt-1 text-sm text-muted">Update your nickname, username, password, picture, and rank.</p>
            </div>
            <Badge variant="outline">{user.role}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
            <Avatar size="lg" src={form.profilePic || undefined} fallback={form.nickname || user.nickname} className="h-16 w-16 text-xl" />
            <div>
              <p className="font-medium text-foreground">{form.nickname || user.nickname}</p>
              <p className="text-sm text-muted">Preview of profile picture and nickname</p>
            </div>
          </div>

          <Input
            label="Nickname"
            value={form.nickname}
            onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
            placeholder="Your display nickname"
          />

          <Input
            label="Username"
            value={form.user}
            onChange={(e) => setForm((prev) => ({ ...prev, user: e.target.value }))}
            placeholder="Your login username"
          />

          <Input
            label="New Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Leave empty to keep current password"
          />

          <Input
            label="Profile Picture URL"
            value={form.profilePic}
            onChange={(e) => setForm((prev) => ({ ...prev, profilePic: e.target.value }))}
            placeholder="https://example.com/avatar.png"
          />

          

          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={saving}>
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
