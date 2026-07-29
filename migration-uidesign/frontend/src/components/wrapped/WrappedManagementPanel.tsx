"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MediaUploadField } from "@/components/ui/MediaUploadField";
import { Select } from "@/components/ui/Select";
import {
  freezeGoongingaWrapped,
  getManageGoongingaWrapped,
  resolveWrappedAssets,
  resolveWrappedSnapshot,
  updateManageGoongingaWrappedAssets,
  type GoongingaWrapped,
  type WrappedAssetKey,
  type WrappedAssets,
  type WrappedMapRanking,
  type WrappedPlayerLeader,
} from "@/lib/api/wrapped";

type AssetField = {
  key: WrappedAssetKey;
  title: string;
  caption: string;
  subject: WrappedPlayerLeader | WrappedMapRanking | null;
  valueSuffix?: string;
};

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function isPlayer(subject: AssetField["subject"]): subject is WrappedPlayerLeader {
  // Legacy Wrapped snapshots did not persist userId, but did include the
  // player name. Use that stable shape discriminator so managers can refresh
  // an old snapshot instead of crashing before the first refresh.
  return Boolean(subject && "player" in subject);
}

function fieldsFor(wrapped: GoongingaWrapped): AssetField[] {
  const { averagesPer10, totals, performance, maps } = resolveWrappedSnapshot(wrapped.snapshot);
  return [
    { key: "averageKills", title: "Cold-blooded finisher", caption: "Kills per 10", subject: averagesPer10.kills, valueSuffix: " / 10" },
    { key: "averageHealing", title: "Lifeline on call", caption: "Healing per 10", subject: averagesPer10.healing, valueSuffix: " / 10" },
    { key: "averageDamage", title: "Pressure, unbroken", caption: "Damage per 10", subject: averagesPer10.damage, valueSuffix: " / 10" },
    { key: "averageMitigation", title: "The wall that held", caption: "Mitigation per 10", subject: averagesPer10.mitigation, valueSuffix: " / 10" },
    { key: "averageAssists", title: "The fight conductor", caption: "Assists per 10", subject: averagesPer10.assists, valueSuffix: " / 10" },
    { key: "averageSurvival", title: "Refused to fall", caption: "Fewest deaths per 10", subject: averagesPer10.lowestDeaths, valueSuffix: " / 10" },
    { key: "totalDamage", title: "A season of impact", caption: "Most total damage", subject: totals.damage },
    { key: "totalHealing", title: "Lifebar architect", caption: "Most total healing", subject: totals.healing },
    { key: "totalMitigation", title: "Frontline fortress", caption: "Most total mitigation", subject: totals.mitigation },
    { key: "bestKd", title: "The cleanest finish", caption: "Best K/D", subject: performance.kd, valueSuffix: " K/D" },
    { key: "mostPickedMap", title: "Home field", caption: "Most selected map", subject: maps.mostPicked, valueSuffix: " picks" },
    { key: "leastPickedMap", title: "The road untaken", caption: "Least selected map", subject: maps.leastPicked, valueSuffix: " picks" },
  ];
}

export function WrappedManagementPanel({ token }: { token: string }) {
  const [wrapped, setWrapped] = useState<GoongingaWrapped | null>(null);
  const [assets, setAssets] = useState<WrappedAssets>({ images: {}, flipped: {}, videos: {}, storyAudios: {}, soundtrack: {} });
  const [loading, setLoading] = useState(true);
  const [freezing, setFreezing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const assetFields = useMemo(() => (wrapped ? fieldsFor(wrapped) : []), [wrapped]);
  const snapshot = wrapped ? resolveWrappedSnapshot(wrapped.snapshot) : null;

  const notify = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    window.setTimeout(() => setNotification(null), 5000);
  };

  async function loadWrapped() {
    try {
      const data = await getManageGoongingaWrapped(token);
      setWrapped(data);
      setAssets(resolveWrappedAssets(data.assets));
    } catch (error: any) {
      if (error?.status !== 404) notify("error", error?.message || "Could not load Goonginga Wrapped.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWrapped();
    // token identifies the active signed-in user for this protected panel.
  }, [token]);

  async function freezeSnapshot() {
    const action = wrapped ? "Refresh" : "Freeze";
    const message = wrapped
      ? "Refresh the locked stats? Media is kept only for slides whose player or map remains unchanged."
      : "Freeze the current finished-game stats for the public Wrapped?";
    if (!window.confirm(message)) return;

    setFreezing(true);
    try {
      const data = await freezeGoongingaWrapped(token);
      const nextAssets = resolveWrappedAssets(data.assets);
      const clearedCount = (Object.keys(assets.videos).length + Object.keys(assets.storyAudios).length) - (Object.keys(nextAssets.videos).length + Object.keys(nextAssets.storyAudios).length);
      setWrapped(data);
      setAssets(nextAssets);
      notify("success", `${action} complete.${clearedCount > 0 ? ` ${clearedCount} outdated media item(s) were cleared.` : ""}`);
    } catch (error: any) {
      notify("error", error?.message || "Could not freeze the Wrapped snapshot.");
    } finally {
      setFreezing(false);
    }
  }

  async function saveAssets() {
    setSaving(true);
    try {
      const data = await updateManageGoongingaWrappedAssets(token, assets);
      setWrapped(data);
      setAssets(resolveWrappedAssets(data.assets));
      notify("success", "Wrapped media saved.");
    } catch (error: any) {
      notify("error", error?.message || "Could not save Wrapped artwork.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card variant="bordered"><CardContent className="p-8 text-center text-muted">Loading Wrapped studio...</CardContent></Card>;

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`rounded-lg border p-4 ${notification.type === "success" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
          {notification.message}
        </div>
      )}

      <Card variant="bordered">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Goonginga Wrapped studio</CardTitle>
            <p className="mt-1 text-sm text-muted">Public playback reads this frozen snapshot only. Refreshing is the only action that recalculates season stats.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {wrapped && <Button variant="secondary" onClick={() => window.open("/wrapped", "_blank")}>Open stream view</Button>}
            <Button onClick={freezeSnapshot} disabled={freezing}>
              {freezing ? (wrapped ? "Refreshing..." : "Freezing...") : (wrapped ? "Refresh locked stats" : "Freeze statistics")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {wrapped ? (
            <div className="grid gap-4 rounded-lg border border-success/25 bg-success/5 p-4 text-sm md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-semibold text-foreground">Frozen {new Date(wrapped.generatedAt).toLocaleString()} · {wrapped.snapshot.tournament.name}</p>
                <p className="mt-1 text-muted">A refresh can change winners, and clears only the media attached to changed players or maps.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Games", snapshot?.overview.games || 0],
                  ["Players", snapshot?.overview.players || 0],
                  ["Teams", snapshot?.overview.teams.length || 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border border-border/70 bg-background/70 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-surface/50 p-5 text-sm text-muted">Freeze after at least one finished game has registered stats. Until then, the public Wrapped remains unavailable.</p>
          )}
        </CardContent>
      </Card>

      {wrapped && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Wrapped soundtrack</CardTitle>
            <p className="mt-1 text-sm text-muted">The intro track loops before Start with a 1.5 second fade-in. The general track begins when the replay starts and ducks to 50% after each story video.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-2">
              <MediaUploadField
                label="Introductory loop"
                type="audio"
                value={assets.soundtrack.intro || ""}
                onChange={(url) => setAssets((current) => ({ ...current, soundtrack: { ...current.soundtrack, intro: url } }))}
                hint="Loops on the cover before Start."
              />
              <MediaUploadField
                label="General Wrapped track"
                type="audio"
                value={assets.soundtrack.general || ""}
                onChange={(url) => setAssets((current) => ({ ...current, soundtrack: { ...current.soundtrack, general: url } }))}
                hint="Plays through the recap and is reduced while story audio cues play."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {wrapped && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Story video introductions</CardTitle>
            <p className="mt-1 text-sm text-muted">Each of the first ten stories lasts 15 seconds. Its video plays first, then its final frame stays on screen while the statistic, title, zoom and audio cues play.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-2">
              {assetFields.slice(0, 10).map((field) => {
                const subject = field.subject;
                const subjectValue = isPlayer(subject)
                  ? `${formatNumber(subject.value, 2)}${field.valueSuffix || ""}`
                  : subject
                  ? `${formatNumber(subject.count)}${field.valueSuffix || ""}`
                  : "No data";
                return (
                  <section key={field.key} className="space-y-3 rounded-lg border border-border bg-surface/40 p-4">
                    <div className="flex items-center gap-3">
                      {isPlayer(subject) ? (
                        <Avatar src={subject.profilePic || undefined} fallback={subject.player} alt={subject.player} size="lg" />
                      ) : subject?.image ? (
                        <img src={subject.image} alt={subject.name} className="h-12 w-16 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded-md bg-surface-elevated text-xs text-muted">MAP</div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{field.caption}</p>
                        <p className="truncate text-base font-semibold text-foreground">{isPlayer(subject) ? subject.player : subject?.name || "No eligible record"}</p>
                        <p className="text-sm text-muted">{isPlayer(subject) ? subject.team || "No team" : subject ? `${subject.count} draft pick${subject.count === 1 ? "" : "s"}` : "Awaiting data"} · {subjectValue}</p>
                      </div>
                    </div>
                    <MediaUploadField
                      label={`Video introduction - ${field.title}`}
                      type="video"
                      value={assets.videos[field.key] || ""}
                      onChange={(url) => setAssets((current) => ({
                        ...current,
                        videos: { ...current.videos, [field.key]: url },
                      }))}
                      placeholder="Upload a 15-second maximum video or paste its URL"
                      hint="Use a clip shorter than 15 seconds so its final frame can hold and zoom."
                    />
                    <Select
                      label="Mirror video horizontally"
                      value={assets.flipped[field.key] ? "yes" : "no"}
                      options={[
                        { value: "no", label: "No" },
                        { value: "yes", label: "Yes" },
                      ]}
                      onChange={(event) => setAssets((current) => ({
                        ...current,
                        flipped: { ...current.flipped, [field.key]: event.target.value === "yes" },
                      }))}
                    />
                    <div className="space-y-3 border-t border-border pt-3">
                      <p className="text-sm font-medium text-foreground">Post-video audio cues <span className="text-muted">(maximum 3, played in order)</span></p>
                      {[0, 1, 2].map((audioIndex) => {
                        const sources = assets.storyAudios[field.key] || [];
                        return (
                          <MediaUploadField
                            key={audioIndex}
                            label={`Audio cue ${audioIndex + 1}`}
                            type="audio"
                            value={sources[audioIndex] || ""}
                            onChange={(url) => setAssets((current) => {
                              const nextSources = [...(current.storyAudios[field.key] || [])];
                              nextSources[audioIndex] = url;
                              while (nextSources.length && !nextSources[nextSources.length - 1]) nextSources.pop();
                              return { ...current, storyAudios: { ...current.storyAudios, [field.key]: nextSources } };
                            })}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end"><Button onClick={saveAssets} disabled={saving}>{saving ? "Saving media..." : "Save Wrapped media"}</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
