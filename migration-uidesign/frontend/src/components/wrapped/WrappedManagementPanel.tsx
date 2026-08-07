"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
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
import { resolveHeroImageUrl } from "@/lib/assetUrls";

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
  const [assets, setAssets] = useState<WrappedAssets & { storyDurations?: Record<string, number> }>({ images: {}, flipped: {}, videos: {}, videoPositions: {}, storyAudios: {}, soundtrack: {}, storyDurations: {} });
  const [loading, setLoading] = useState(true);
  const [freezing, setFreezing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const assetFields = useMemo(() => (wrapped ? fieldsFor(wrapped) : []), [wrapped]);
  const snapshot = wrapped ? resolveWrappedSnapshot(wrapped.snapshot) : null;
  const heroBans = snapshot?.heroes || { mostBanned: null, leastBanned: null };
  const getStoryDurationValue = (key: string, fallback: number) => {
    const value = assets.storyDurations?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (key === "thanksBefore") {
      const legacyValue = assets.storyDurations?.thanks;
      if (typeof legacyValue === "number" && Number.isFinite(legacyValue) && legacyValue > 0) return legacyValue;
    }
    return fallback;
  };

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
      if (error?.status !== 404) notify("error", error?.message || "Could not load the Finals recap.");
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
      : "Freeze the current finished-game stats for the Finals recap?";
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
      notify("error", error?.message || "Could not freeze the Finals snapshot.");
    } finally {
      setFreezing(false);
    }
  }

  async function saveAssets() {
    setSaving(true);
    try {
      const data = await updateManageGoongingaWrappedAssets(token, assets);
      setWrapped(data);
      const nextAssets = resolveWrappedAssets(data.assets) as WrappedAssets & { storyDurations?: Record<string, number> };
      setAssets({ ...nextAssets, storyDurations: (data.assets as any)?.storyDurations || {} });
      notify("success", "Finals media saved.");
    } catch (error: any) {
      notify("error", error?.message || "Could not save Finals media.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card variant="bordered"><CardContent className="p-8 text-center text-muted">Loading Finals studio...</CardContent></Card>;

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
            <CardTitle>Goonginga Finals studio</CardTitle>
            <p className="mt-1 text-sm text-muted">The recap unlocks only while the tournament is in Finals. Playback reads this frozen snapshot and never recalculates live stats.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {wrapped && <Button variant="secondary" onClick={() => window.open("/finals", "_blank")}>Open Finals view</Button>}
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
                  ["Maps played", snapshot?.overview.games || 0],
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
            <p className="rounded-lg border border-border bg-surface/50 p-5 text-sm text-muted">Freeze after at least one finished game has registered stats. Until then, the Finals recap remains unavailable.</p>
          )}
        </CardContent>
      </Card>

      {wrapped && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Finals audio tracks</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Upload one track for the opening screens, one dedicated fade-in cue for the stats transition,
              and one track that begins with the first highlight. The countdown track remains independent.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-2">
              <MediaUploadField
                label="Finals countdown track"
                type="audio"
                token={token}
                value={assets.soundtrack.countdown?.url || ""}
                onChange={(url) => setAssets((current) => ({
                  ...current,
                  soundtrack: url
                    ? { ...current.soundtrack, countdown: { url, durationSeconds: current.soundtrack.countdown?.durationSeconds } }
                    : { ...current.soundtrack, countdown: undefined },
                }))}
                onDurationChange={(durationSeconds) => setAssets((current) => ({
                  ...current,
                  soundtrack: current.soundtrack.countdown
                    ? { ...current.soundtrack, countdown: { ...current.soundtrack.countdown, ...(durationSeconds ? { durationSeconds } : {}) } }
                    : current.soundtrack,
                }))}
                hint={assets.soundtrack.countdown?.durationSeconds
                  ? `Starts automatically at ${assets.soundtrack.countdown.durationSeconds.toFixed(1)} seconds remaining.`
                  : "Duration is read from the uploaded file and saved with the track."}
              />

              <MediaUploadField
                label="Opening screens track"
                type="audio"
                token={token}
                value={assets.soundtrack.intro?.url || assets.soundtrack.recap?.url || ""}
                onChange={(url) => setAssets((current) => {
                  const durationSeconds = current.soundtrack.intro?.durationSeconds
                    ?? current.soundtrack.recap?.durationSeconds;
                  const nextTrack = url ? { url, ...(durationSeconds ? { durationSeconds } : {}) } : undefined;
                  return {
                    ...current,
                    soundtrack: {
                      ...current.soundtrack,
                      intro: nextTrack,
                      // Keep the old alias synchronized for FinalsPresentationStage.
                      recap: nextTrack,
                    },
                  };
                })}
                onDurationChange={(durationSeconds) => setAssets((current) => {
                  const currentTrack = current.soundtrack.intro || current.soundtrack.recap;
                  if (!currentTrack) return current;
                  const nextTrack = { ...currentTrack, ...(durationSeconds ? { durationSeconds } : {}) };
                  return {
                    ...current,
                    soundtrack: {
                      ...current.soundtrack,
                      intro: nextTrack,
                      recap: nextTrack,
                    },
                  };
                })}
                hint={assets.soundtrack.intro?.durationSeconds || assets.soundtrack.recap?.durationSeconds
                  ? `Saved duration: ${(assets.soundtrack.intro?.durationSeconds || assets.soundtrack.recap?.durationSeconds || 0).toFixed(1)} seconds. Starts when the Wrapped begins.`
                  : "Plays from the first RAT'S PRODUCTIONS screen through the pre-highlight opening screens."}
              />

              <MediaUploadField
                label="Stats transition track"
                type="audio"
                token={token}
                value={assets.soundtrack.statsIntro?.url || ""}
                onChange={(url) => setAssets((current) => ({
                  ...current,
                  soundtrack: url
                    ? { ...current.soundtrack, statsIntro: { url, durationSeconds: current.soundtrack.statsIntro?.durationSeconds } }
                    : { ...current.soundtrack, statsIntro: undefined },
                }))}
                onDurationChange={(durationSeconds) => setAssets((current) => ({
                  ...current,
                  soundtrack: current.soundtrack.statsIntro
                    ? { ...current.soundtrack, statsIntro: { ...current.soundtrack.statsIntro, ...(durationSeconds ? { durationSeconds } : {}) } }
                    : current.soundtrack,
                }))}
                hint={assets.soundtrack.statsIntro?.durationSeconds
                  ? `Saved duration: ${assets.soundtrack.statsIntro.durationSeconds.toFixed(1)} seconds. Fades in on the “And now...” screen.`
                  : "Dedicated cue for “And now... It’s time to see who led the season in numbers.”"}
              />

              <MediaUploadField
                label="Highlights track"
                type="audio"
                token={token}
                value={assets.soundtrack.highlights?.url || assets.soundtrack.recap?.url || ""}
                onChange={(url) => setAssets((current) => ({
                  ...current,
                  soundtrack: url
                    ? { ...current.soundtrack, highlights: { url, durationSeconds: current.soundtrack.highlights?.durationSeconds } }
                    : { ...current.soundtrack, highlights: undefined },
                }))}
                onDurationChange={(durationSeconds) => setAssets((current) => ({
                  ...current,
                  soundtrack: current.soundtrack.highlights
                    ? { ...current.soundtrack, highlights: { ...current.soundtrack.highlights, ...(durationSeconds ? { durationSeconds } : {}) } }
                    : current.soundtrack,
                }))}
                hint={assets.soundtrack.highlights?.durationSeconds
                  ? `Saved duration: ${assets.soundtrack.highlights.durationSeconds.toFixed(1)} seconds. Starts with the first player highlight.`
                  : "Continues through the player, hero, map and season-summary highlights."}
              />
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={saveAssets} disabled={saving}>{saving ? "Saving audio..." : "Save Finals audio"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {wrapped && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Hero Bans portraits</CardTitle>
            <p className="mt-1 text-sm text-muted">Upload taller images for the most and least banned heroes. These overrides only affect the Hero Bans slide.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { key: "heroBanMost" as const, title: "Most banned", hero: heroBans.mostBanned, value: assets.images.heroBanMost || "", placeholder: "Paste a portrait URL or upload a vertical image" },
                { key: "heroBanLeast" as const, title: "Least banned", hero: heroBans.leastBanned, value: assets.images.heroBanLeast || "", placeholder: "Paste a portrait URL or upload a vertical image" },
              ].map((item) => (
                <section key={item.key} className="space-y-4 rounded-lg border border-border bg-surface/40 p-4">
                  <div className="flex items-center gap-3">
                    {item.hero?.image ? (
                      <img src={resolveHeroImageUrl(item.hero.image)} alt={item.hero.name} className="h-20 w-14 rounded-md object-cover" />
                    ) : (
                      <div className="flex h-20 w-14 items-center justify-center rounded-md bg-surface-elevated text-xs text-muted">HERO</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{item.title}</p>
                      <p className="truncate text-base font-semibold text-foreground">{item.hero?.name || "No hero data"}</p>
                      <p className="text-sm text-muted">{item.hero ? `${item.hero.count} bans recorded` : "Waiting for snapshot data"}</p>
                    </div>
                  </div>
                  <ImageUploadField
                    label={`${item.title} image override`}
                    type="hero"
                    value={item.value}
                    onChange={(url) => setAssets((current) => ({
                      ...current,
                      images: { ...current.images, [item.key]: url },
                    }))}
                    previewAlt={`${item.title} portrait preview`}
                    previewClassName="h-56 w-40 rounded-2xl"
                    placeholder={item.placeholder}
                  />
                </section>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={saveAssets} disabled={saving}>{saving ? "Saving hero images..." : "Save Hero Bans images"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {wrapped && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Pre-highlight story timing</CardTitle>
            <p className="mt-1 text-sm text-muted">Set the runtime of each intro screen before the player highlights begin. Values accept decimals for smoother pacing.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { key: "intro", label: "Brand intro", defaultValue: 4.5 },
                { key: "finalists", label: "Finalists showdown", defaultValue: 12.5 },
                { key: "thanksBefore", label: "Thank-you roster", defaultValue: 7.25 },
                { key: "community", label: "Community tribute", defaultValue: 8 },
                { key: "statsIntro", label: "Stats transition", defaultValue: 7 },
              ].map((item) => (
                <label key={item.key} className="grid gap-2 rounded-lg border border-border bg-surface/40 p-3 text-sm text-foreground">
                  <span className="flex items-center justify-between">
                    <span>{item.label}</span>
                    <strong>{getStoryDurationValue(item.key, item.defaultValue).toFixed(2)}s</strong>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.25"
                    value={getStoryDurationValue(item.key, item.defaultValue)}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setAssets((current) => ({
                        ...current,
                        storyDurations: {
                          ...(current.storyDurations || {}),
                          [item.key]: value,
                        },
                      }));
                    }}
                    className="w-full accent-primary"
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={saveAssets} disabled={saving}>{saving ? "Saving timing..." : "Save timing"}</Button>
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
                      token={token}
                      value={assets.videos[field.key] || ""}
                      onChange={(url) => setAssets((current) => ({
                        ...current,
                        videos: { ...current.videos, [field.key]: url },
                      }))}
                      placeholder="Upload a 15-second maximum video or paste its URL"
                      hint="Use MP4 (H.264 + AAC) or WebM under 15 seconds. For smooth browser/OBS playback, keep each clip near 10–15 MB."
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
                    <div className="space-y-3 rounded-md border border-border/70 bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Video framing</p>
                          <p className="text-xs text-muted">Adjust the visible focal point after mirroring.</p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setAssets((current) => ({
                            ...current,
                            videoPositions: { ...current.videoPositions, [field.key]: { x: 50, y: 50 } },
                          }))}
                        >
                          Center
                        </Button>
                      </div>
                      {(["x", "y"] as const).map((axis) => {
                        const position = assets.videoPositions[field.key] || { x: 50, y: 50 };
                        const label = axis === "x" ? "Horizontal" : "Vertical";
                        return (
                          <label key={axis} className="grid gap-2 text-sm text-foreground">
                            <span className="flex items-center justify-between">
                              <span>{label}</span>
                              <strong>{Math.round(position[axis])}%</strong>
                            </span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={position[axis]}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setAssets((current) => {
                                  const currentPosition = current.videoPositions[field.key] || { x: 50, y: 50 };
                                  return {
                                    ...current,
                                    videoPositions: {
                                      ...current.videoPositions,
                                      [field.key]: { ...currentPosition, [axis]: value },
                                    },
                                  };
                                });
                              }}
                              className="w-full accent-primary"
                            />
                          </label>
                        );
                      })}
                    </div>
                    <div className="space-y-3 border-t border-border pt-3">
                      <p className="text-sm font-medium text-foreground">Post-video audio cues <span className="text-muted">(maximum 3, played in order)</span></p>
                      {[0, 1, 2].map((audioIndex) => {
                        const sources = assets.storyAudios[field.key] || [];
                        return (
                          <MediaUploadField
                            key={audioIndex}
                            label={`Audio cue ${audioIndex + 1}`}
                            type="audio"
                            token={token}
                            value={sources[audioIndex] || ""}
                            onChange={(url) => setAssets((current) => {
                              const nextSources = [...(current.storyAudios[field.key] || [])];
                              nextSources[audioIndex] = url;
                              while (nextSources.length && !nextSources[nextSources.length - 1]) nextSources.pop();
                              return { ...current, storyAudios: { ...current.storyAudios, [field.key]: nextSources } };
                            })}
                            hint="Use MP3/AAC at 128–192 kbps; avoid 30–40 MB cues so the stream stays smooth."
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end"><Button onClick={saveAssets} disabled={saving}>{saving ? "Saving media..." : "Save Finals media"}</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}