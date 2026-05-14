"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/features/session/SessionProvider";
import {
  getLeaderboard,
  getLeaderboardOverlayAsset,
  getMatchById,
  getMatches,
  getMatchesByWeek,
  getTeams,
  updateLeaderboardOverlayAsset,
  type LeaderboardOverlaySettings,
  type Match,
  type Team,
} from "@/lib/api";
import { deleteBlobImage, uploadImageToBlob } from "@/lib/blobUpload";
import {
  DEFAULT_LEADERBOARD_OVERLAY_SETTINGS,
  normalizeLeaderboardOverlaySettings,
  OVERLAY_FONT_OPTIONS,
} from "@/lib/overlay/leaderboardOverlay";
import { LeaderboardOverlayFromData } from "@/app/overlay/components/LeaderboardOverlay";

const OVERLAY_WIDTH = 1920;
const OVERLAY_HEIGHT = 1080;
const PREVIEW_WIDTH = 480;
const PREVIEW_HEIGHT = 270;
const previewScale = PREVIEW_WIDTH / OVERLAY_WIDTH;

export default function AssetsEditionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isAuthenticated, isHydrated } = useSession();
  const queryMatchId = useMemo(() => Number(searchParams.get("matchId")), [searchParams]);

  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [leaderboard, setLeaderboard] = useState<Team[]>([]);
  const [weekMatches, setWeekMatches] = useState<Match[]>([]);
  const [settings, setSettings] = useState<LeaderboardOverlaySettings>(DEFAULT_LEADERBOARD_OVERLAY_SETTINGS);
  const [savedBackgroundImageUrl, setSavedBackgroundImageUrl] = useState<string | null>(null);

  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreviewUrl, setBackgroundPreviewUrl] = useState<string | null>(null);
  const [useBlackBackground, setUseBlackBackground] = useState(false);

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingOverlayData, setLoadingOverlayData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== "MANAGER")) {
      router.push("/login");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "MANAGER") return;

    let cancelled = false;

    const loadBase = async () => {
      try {
        setLoadingBase(true);
        const [matchesData, teamsData] = await Promise.all([getMatches(), getTeams()]);
        if (cancelled) return;

        const sortedMatches = [...matchesData].sort((a, b) => {
          const weekDiff = (a.semanas || 0) - (b.semanas || 0);
          if (weekDiff !== 0) return weekDiff;
          return a.id - b.id;
        });

        setMatches(sortedMatches);
        setTeams(teamsData);

        const defaultMatchId = Number.isInteger(queryMatchId) && queryMatchId > 0
          ? queryMatchId
          : sortedMatches[0]?.id ?? null;
        setSelectedMatchId(defaultMatchId);
      } catch (error) {
        const text = error instanceof Error ? error.message : "Failed to load manager data.";
        setMessage(text);
      } finally {
        if (!cancelled) setLoadingBase(false);
      }
    };

    void loadBase();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, queryMatchId]);

  useEffect(() => {
    if (backgroundPreviewUrl) {
      return () => URL.revokeObjectURL(backgroundPreviewUrl);
    }
    return undefined;
  }, [backgroundPreviewUrl]);

  useEffect(() => {
    if (!selectedMatch) return;

    let cancelled = false;
    const weekToLoad = Number.isInteger(Number(settings.weekNumber)) ? Number(settings.weekNumber) : 1;

    const loadWeekMatches = async () => {
      try {
        const data = await getMatchesByWeek(selectedMatch.tournamentId, weekToLoad);
        if (cancelled) return;
        setWeekMatches(data.sort((a, b) => a.id - b.id));
      } catch {
        if (cancelled) return;
        setWeekMatches([]);
      }
    };

    void loadWeekMatches();
    return () => {
      cancelled = true;
    };
  }, [selectedMatch, settings.weekNumber]);

  useEffect(() => {
    if (!selectedMatchId || !isAuthenticated || user?.role !== "MANAGER") return;

    let cancelled = false;

    const loadOverlayData = async () => {
      try {
        setLoadingOverlayData(true);
        setMessage(null);

        const loadedMatch = await getMatchById(selectedMatchId);
        const [leaderboardData, overlayAsset] = await Promise.all([
          getLeaderboard(loadedMatch.tournamentId),
          getLeaderboardOverlayAsset(selectedMatchId),
        ]);
        const normalizedSettings = normalizeLeaderboardOverlaySettings(overlayAsset.settings);
        const weekToLoad = Number.isInteger(Number(normalizedSettings.weekNumber))
          ? Number(normalizedSettings.weekNumber)
          : Number.isInteger(Number(loadedMatch.semanas))
          ? Number(loadedMatch.semanas)
          : 1;
        const weekMatchesData = await getMatchesByWeek(loadedMatch.tournamentId, weekToLoad);

        if (cancelled) return;

        setSelectedMatch(loadedMatch);
        setLeaderboard(leaderboardData);
        setWeekMatches(weekMatchesData.sort((a, b) => a.id - b.id));
        setSavedBackgroundImageUrl(overlayAsset.backgroundImageUrl ?? null);
        setSettings(normalizedSettings);

        setBackgroundFile(null);
        setUseBlackBackground(false);
        setBackgroundPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });

        router.replace(`/assets-edition?matchId=${selectedMatchId}`, { scroll: false });
      } catch (error) {
        if (cancelled) return;
        const text = error instanceof Error ? error.message : "Failed to load overlay asset data.";
        setMessage(text);
      } finally {
        if (!cancelled) setLoadingOverlayData(false);
      }
    };

    void loadOverlayData();

    return () => {
      cancelled = true;
    };
  }, [selectedMatchId, isAuthenticated, user, router]);

  const displayedBackgroundUrl = useMemo(() => {
    if (useBlackBackground) return null;
    return backgroundPreviewUrl || savedBackgroundImageUrl;
  }, [useBlackBackground, backgroundPreviewUrl, savedBackgroundImageUrl]);

  const updateSettings = (updater: (prev: LeaderboardOverlaySettings) => LeaderboardOverlaySettings) => {
    setSettings((prev) => normalizeLeaderboardOverlaySettings(updater(prev)));
  };

  const handleBackgroundSelection = (file: File | null) => {
    setBackgroundFile(file);
    setUseBlackBackground(false);

    setBackgroundPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const handleSave = async () => {
    if (!token || !selectedMatchId) return;

    setSaving(true);
    setMessage(null);

    let uploadedUrl: string | null = null;

    try {
      let nextBackgroundUrl = savedBackgroundImageUrl;

      if (useBlackBackground) {
        nextBackgroundUrl = null;
      } else if (backgroundFile) {
        uploadedUrl = await uploadImageToBlob(backgroundFile, "image");
        nextBackgroundUrl = uploadedUrl;
      }

      await updateLeaderboardOverlayAsset(token, selectedMatchId, {
        backgroundImageUrl: nextBackgroundUrl,
        settings,
      });

      const previousUrl = savedBackgroundImageUrl;

      if (previousUrl && previousUrl !== nextBackgroundUrl) {
        await deleteBlobImage(previousUrl).catch(() => null);
      }

      setSavedBackgroundImageUrl(nextBackgroundUrl ?? null);
      setBackgroundFile(null);
      setUseBlackBackground(false);
      setBackgroundPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      setMessage("Overlay saved successfully.");
    } catch (error) {
      if (uploadedUrl) {
        await deleteBlobImage(uploadedUrl).catch(() => null);
      }
      const text = error instanceof Error ? error.message : "Failed to save overlay settings.";
      setMessage(text);
    } finally {
      setSaving(false);
    }
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "MANAGER") return null;

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit Assets</h1>
            <p className="text-muted mt-1">
              Configure the overlay rendered in <code>/overlay/leaderboard/:id</code>.
            </p>
          </div>

          {selectedMatchId ? (
            <Link
              href={`/overlay/leaderboard/${selectedMatchId}`}
              target="_blank"
              className="inline-flex items-center justify-center rounded-md bg-surface-elevated text-foreground hover:bg-border active:bg-border/90 px-4 py-2 text-sm font-medium transition-colors"
            >
              Open Overlay
            </Link>
          ) : null}
        </div>

        <Card variant="featured">
          <CardHeader>
            <CardTitle>Target Match</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingBase ? (
              <p className="text-muted">Loading matches...</p>
            ) : matches.length === 0 ? (
              <p className="text-muted">No matches found.</p>
            ) : (
              <label className="block text-sm">
                <span className="text-muted">Match</span>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  value={selectedMatchId ?? ""}
                  onChange={(event) => setSelectedMatchId(Number(event.target.value))}
                >
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      #{match.id} - Week {match.semanas ?? "-"} - {match.type} - {match.status}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </CardContent>
        </Card>

        {selectedMatch && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Background</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="block text-sm">
                    <span className="text-muted">Upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      onChange={(event) => handleBackgroundSelection(event.target.files?.[0] ?? null)}
                    />
                  </label>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={useBlackBackground ? "primary" : "secondary"}
                      onClick={() => {
                        setUseBlackBackground((prev) => !prev);
                        if (!useBlackBackground) {
                          setBackgroundFile(null);
                          setBackgroundPreviewUrl((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return null;
                          });
                        }
                      }}
                    >
                      {useBlackBackground ? "Using black background" : "Use black background"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Week Title Style</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <label className="text-sm">
                    <span className="text-muted">Week number</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.weekNumber}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          weekNumber: Number(event.target.value),
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Font</span>
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.title.fontFamily}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          title: { ...prev.title, fontFamily: event.target.value },
                        }))
                      }
                    >
                      {OVERLAY_FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Color</span>
                    <input
                      type="color"
                      className="mt-1 h-10 w-full rounded-md border border-border bg-background"
                      value={settings.title.color}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          title: { ...prev.title, color: event.target.value },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Size</span>
                    <input
                      type="number"
                      min={20}
                      max={180}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.title.fontSize}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          title: { ...prev.title, fontSize: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Position X</span>
                    <input
                      type="number"
                      min={-900}
                      max={900}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.title.offsetX}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          title: { ...prev.title, offsetX: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Position Y</span>
                    <input
                      type="number"
                      min={-500}
                      max={500}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.title.offsetY}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          title: { ...prev.title, offsetY: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Leaderboard Style</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <label className="text-sm">
                    <span className="text-muted">Font</span>
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.leaderboard.fontFamily}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          leaderboard: { ...prev.leaderboard, fontFamily: event.target.value },
                        }))
                      }
                    >
                      {OVERLAY_FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Color</span>
                    <input
                      type="color"
                      className="mt-1 h-10 w-full rounded-md border border-border bg-background"
                      value={settings.leaderboard.color}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          leaderboard: { ...prev.leaderboard, color: event.target.value },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Font size</span>
                    <input
                      type="number"
                      min={16}
                      max={120}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.leaderboard.fontSize}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          leaderboard: { ...prev.leaderboard, fontSize: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Column gap</span>
                    <input
                      type="number"
                      min={0}
                      max={140}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.leaderboard.columnGap}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          leaderboard: { ...prev.leaderboard, columnGap: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Row gap</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.leaderboard.rowGap}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          leaderboard: { ...prev.leaderboard, rowGap: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Scale</span>
                    <input
                      type="number"
                      min={0.3}
                      max={2}
                      step={0.05}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.leaderboard.scale}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          leaderboard: { ...prev.leaderboard, scale: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Position X</span>
                    <input
                      type="number"
                      min={-900}
                      max={900}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.leaderboard.offsetX}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          leaderboard: { ...prev.leaderboard, offsetX: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Position Y</span>
                    <input
                      type="number"
                      min={-500}
                      max={500}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.leaderboard.offsetY}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          leaderboard: { ...prev.leaderboard, offsetY: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Match Cards Style</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <label className="text-sm">
                    <span className="text-muted">Font</span>
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.matches.fontFamily}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          matches: { ...prev.matches, fontFamily: event.target.value },
                        }))
                      }
                    >
                      {OVERLAY_FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Color</span>
                    <input
                      type="color"
                      className="mt-1 h-10 w-full rounded-md border border-border bg-background"
                      value={settings.matches.color}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          matches: { ...prev.matches, color: event.target.value },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Font size</span>
                    <input
                      type="number"
                      min={16}
                      max={120}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.matches.fontSize}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          matches: { ...prev.matches, fontSize: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Column gap</span>
                    <input
                      type="number"
                      min={0}
                      max={140}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.matches.columnGap}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          matches: { ...prev.matches, columnGap: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Row gap</span>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.matches.rowGap}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          matches: { ...prev.matches, rowGap: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Scale</span>
                    <input
                      type="number"
                      min={0.3}
                      max={2}
                      step={0.05}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.matches.scale}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          matches: { ...prev.matches, scale: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Position X</span>
                    <input
                      type="number"
                      min={-900}
                      max={900}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.matches.offsetX}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          matches: { ...prev.matches, offsetX: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>

                  <label className="text-sm">
                    <span className="text-muted">Position Y</span>
                    <input
                      type="number"
                      min={-500}
                      max={500}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                      value={settings.matches.offsetY}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          matches: { ...prev.matches, offsetY: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void handleSave()} disabled={saving || loadingOverlayData}>
                  {saving ? "Saving..." : "Save overlay"}
                </Button>
                {message ? <span className="text-sm text-muted">{message}</span> : null}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Live Preview (1920x1080)</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingOverlayData ? (
                  <p className="text-muted">Loading preview...</p>
                ) : (
                  <div className="flex justify-center">
                    <div
                      className="border border-border rounded-md overflow-hidden bg-black relative"
                      style={{ width: `${PREVIEW_WIDTH}px`, height: `${PREVIEW_HEIGHT}px` }}
                    >
                      <div
                        style={{
                          width: `${OVERLAY_WIDTH}px`,
                          height: `${OVERLAY_HEIGHT}px`,
                          transform: `scale(${previewScale})`,
                          transformOrigin: "top left",
                          position: "absolute",
                          left: "0px",
                          top: "0px",
                        }}
                      >
                        <LeaderboardOverlayFromData
                          match={selectedMatch}
                          allTeams={teams}
                          leaderboard={leaderboard}
                          weekMatches={weekMatches}
                          settings={settings}
                          backgroundImageUrl={displayedBackgroundUrl}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
