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
  getMatchesByTournament,
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
const PREVIEW_WIDTH = 680;
const PREVIEW_HEIGHT = 382;
const previewScale = PREVIEW_WIDTH / OVERLAY_WIDTH;

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

function SliderInput({ label, value, min, max, step = 1, onChange }: SliderInputProps) {
  const pct = max > min ? Math.round(((value - min) / (max - min)) * 100) : 0;

  return (
    <div className="rounded-lg bg-surface-elevated p-3 border border-border/50">
      <label className="text-sm">
        <span className="text-muted text-xs uppercase tracking-wide font-semibold">{label}</span>
        <div className="mt-3 flex items-center gap-3">
          <style jsx>{`
            input[type="range"] {
              width: 100%;
              height: 8px;
              border-radius: 4px;
              background: transparent;
              outline: none;
              -webkit-appearance: none;
              appearance: none;
            }
            input[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 18px;
              height: 18px;
              border-radius: 3px;
              background: hsl(var(--primary));
              cursor: pointer;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
              border: 2px solid hsl(var(--background));
            }
            input[type="range"]::-moz-range-thumb {
              width: 18px;
              height: 18px;
              border-radius: 3px;
              background: hsl(var(--primary));
              cursor: pointer;
              border: 2px solid hsl(var(--background));
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
            }
            input[type="range"]::-moz-range-track {
              background: transparent;
              border: none;
              height: 8px;
            }
            input[type="range"]::-webkit-slider-runnable-track {
              background: transparent;
              height: 8px;
              border-radius: 4px;
            }
          `}</style>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${pct}%, rgba(255,255,255,0.06) ${pct}%, rgba(255,255,255,0.06) 100%)`,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.25)",
            }}
          />
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-20 rounded bg-background px-2 py-1 text-right text-sm font-mono border border-border/60"
          />
        </div>
      </label>
    </div>
  );
}

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
          // Push scheduled matches to the bottom
          if (a.status === "SCHEDULED" && b.status !== "SCHEDULED") return 1;
          if (b.status === "SCHEDULED" && a.status !== "SCHEDULED") return -1;

          // Then sort by startDate (soonest first)
          const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
          if (aDate !== bDate) return aDate - bDate;

          // Fallback to week number then id
          const weekDiff = (a.semanas || 0) - (b.semanas || 0);
          if (weekDiff !== 0) return weekDiff;
          return a.id - b.id;
        });

        setMatches(sortedMatches);
        setTeams(teamsData);

        const soonestScheduledMatch = sortedMatches.find((match) => match.status === "SCHEDULED");
        const defaultMatchId = Number.isInteger(queryMatchId) && queryMatchId > 0
          ? queryMatchId
          : soonestScheduledMatch?.id ?? sortedMatches[0]?.id ?? null;
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
    const weekToLoad = Number.isInteger(Number(selectedMatch.semanas))
      ? Number(selectedMatch.semanas)
      : Number.isInteger(Number(settings.weekNumber))
      ? Number(settings.weekNumber)
      : 1;

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
        const finalSettings = {
          ...normalizedSettings,
          weekNumber: Number.isInteger(Number(loadedMatch.semanas))
            ? Number(loadedMatch.semanas)
            : normalizedSettings.weekNumber,
        };
        const weekToLoad = Number.isInteger(Number(loadedMatch.semanas))
          ? Number(loadedMatch.semanas)
          : Number.isInteger(Number(normalizedSettings.weekNumber))
          ? Number(normalizedSettings.weekNumber)
          : 1;
        const weekMatchesData = await getMatchesByWeek(loadedMatch.tournamentId, weekToLoad);

        if (cancelled) return;

        setSelectedMatch(loadedMatch);
        setLeaderboard(leaderboardData);
        setWeekMatches(weekMatchesData.sort((a, b) => a.id - b.id));
          setSavedBackgroundImageUrl(overlayAsset.backgroundImageUrl ?? null);
        setSettings(finalSettings);

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

      // Save the shared overlay structure used by every match overlay.
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
              Configure the shared overlay structure. Saving updates every match overlay.
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
            <CardTitle>Preview Match</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingBase ? (
              <p className="text-muted">Loading matches...</p>
            ) : matches.length === 0 ? (
              <p className="text-muted">No matches found.</p>
            ) : (
              <label className="block text-sm">
                <span className="text-muted">Preview match</span>
                <p className="text-xs text-muted mt-1">
                  Choose a match to preview how the overlay looks for that match. Saving will update only this match's overlay.
                </p>
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
          <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6 items-start">
            {/* Left Column: Controls */}
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
              <Card className="border-border/60 bg-surface-elevated/80">
                <CardHeader>
                  <CardTitle className="text-lg">Background</CardTitle>
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

              <Card className="border-border/60 bg-surface-elevated/80">
                <CardHeader>
                  <CardTitle className="text-lg">Week Title</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SliderInput
                    label="Week number"
                    value={settings.weekNumber}
                    min={1}
                    max={99}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        weekNumber: value,
                      }))
                    }
                  />

                  <label className="text-sm rounded-lg bg-surface-elevated p-3 border border-border/50 block">
                    <span className="text-muted text-xs uppercase tracking-wide font-semibold">Font</span>
                    <select
                      className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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

                  <label className="text-sm rounded-lg bg-surface-elevated p-3 border border-border/50 block">
                    <span className="text-muted text-xs uppercase tracking-wide font-semibold">Color</span>
                    <input
                      type="color"
                      className="mt-2 h-10 w-full rounded-md border border-border bg-background"
                      value={settings.title.color}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          title: { ...prev.title, color: event.target.value },
                        }))
                      }
                    />
                  </label>

                  <SliderInput
                    label="Letter size"
                    value={settings.title.fontSize}
                    min={20}
                    max={180}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        title: { ...prev.title, fontSize: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Position X"
                    value={settings.title.offsetX}
                    min={-900}
                    max={900}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        title: { ...prev.title, offsetX: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Position Y"
                    value={settings.title.offsetY}
                    min={-500}
                    max={500}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        title: { ...prev.title, offsetY: value },
                      }))
                    }
                  />
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-surface-elevated/80">
                <CardHeader>
                  <CardTitle className="text-lg">Leaderboard</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="text-sm rounded-lg bg-surface-elevated p-3 border border-border/50 block">
                    <span className="text-muted text-xs uppercase tracking-wide font-semibold">Font</span>
                    <select
                      className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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

                  <label className="text-sm rounded-lg bg-surface-elevated p-3 border border-border/50 block">
                    <span className="text-muted text-xs uppercase tracking-wide font-semibold">Color</span>
                    <input
                      type="color"
                      className="mt-2 h-10 w-full rounded-md border border-border bg-background"
                      value={settings.leaderboard.color}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          leaderboard: { ...prev.leaderboard, color: event.target.value },
                        }))
                      }
                    />
                  </label>

                  <SliderInput
                    label="Letter size"
                    value={settings.leaderboard.fontSize}
                    min={16}
                    max={120}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        leaderboard: { ...prev.leaderboard, fontSize: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Column gap"
                    value={settings.leaderboard.columnGap}
                    min={0}
                    max={140}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        leaderboard: { ...prev.leaderboard, columnGap: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Row gap"
                    value={settings.leaderboard.rowGap}
                    min={0}
                    max={100}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        leaderboard: { ...prev.leaderboard, rowGap: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Scale"
                    value={settings.leaderboard.scale}
                    min={0.3}
                    max={2}
                    step={0.05}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        leaderboard: { ...prev.leaderboard, scale: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Position X"
                    value={settings.leaderboard.offsetX}
                    min={-900}
                    max={900}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        leaderboard: { ...prev.leaderboard, offsetX: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Position Y"
                    value={settings.leaderboard.offsetY}
                    min={-500}
                    max={500}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        leaderboard: { ...prev.leaderboard, offsetY: value },
                      }))
                    }
                  />
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-surface-elevated/80">
                <CardHeader>
                  <CardTitle className="text-lg">Team Blocks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="text-sm rounded-lg bg-surface-elevated p-3 border border-border/50 block">
                    <span className="text-muted text-xs uppercase tracking-wide font-semibold">Font</span>
                    <select
                      className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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

                  <SliderInput
                    label="Letter size"
                    value={settings.matches.fontSize}
                    min={16}
                    max={120}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, fontSize: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Logo size"
                    value={settings.matches.logoSize}
                    min={40}
                    max={200}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, logoSize: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Logo gap"
                    value={settings.matches.logoGap}
                    min={0}
                    max={140}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, logoGap: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Column gap"
                    value={settings.matches.columnGap}
                    min={0}
                    max={140}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, columnGap: value },
                      }))
                    }
                  />
                  <SliderInput
                    label="Left column gap"
                    value={settings.matches.teamAColumnGap ?? settings.matches.columnGap}
                    min={0}
                    max={140}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, teamAColumnGap: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Right column gap"
                    value={settings.matches.teamBColumnGap ?? settings.matches.columnGap}
                    min={0}
                    max={140}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, teamBColumnGap: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Row gap"
                    value={settings.matches.rowGap}
                    min={0}
                    max={120}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, rowGap: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Scale"
                    value={settings.matches.scale}
                    min={0.3}
                    max={2}
                    step={0.05}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, scale: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Position X"
                    value={settings.matches.offsetX}
                    min={-900}
                    max={900}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, offsetX: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Position Y"
                    value={settings.matches.offsetY}
                    min={-500}
                    max={500}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, offsetY: value },
                      }))
                    }
                  />
                  <SliderInput
                    label="Left team X"
                    value={settings.matches.teamAOffsetX ?? 0}
                    min={-900}
                    max={900}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, teamAOffsetX: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Left team Y"
                    value={settings.matches.teamAOffsetY ?? 0}
                    min={-500}
                    max={500}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, teamAOffsetY: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Right team X"
                    value={settings.matches.teamBOffsetX ?? 0}
                    min={-900}
                    max={900}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, teamBOffsetX: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Right team Y"
                    value={settings.matches.teamBOffsetY ?? 0}
                    min={-500}
                    max={500}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, teamBOffsetY: value },
                      }))
                    }
                  />
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-surface-elevated/80">
                <CardHeader>
                  <CardTitle className="text-lg">VS Center</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="text-sm rounded-lg bg-surface-elevated p-3 border border-border/50 block">
                    <span className="text-muted text-xs uppercase tracking-wide font-semibold">Font</span>
                    <select
                      className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      value={settings.matches.centerFontFamily}
                      onChange={(event) =>
                        updateSettings((prev) => ({
                          ...prev,
                          matches: { ...prev.matches, centerFontFamily: event.target.value },
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

                  <SliderInput
                    label="VS size"
                    value={settings.matches.centerFontSize ?? Math.round(settings.matches.fontSize * 1.6)}
                    min={8}
                    max={300}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, centerFontSize: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="VS offset X"
                    value={settings.matches.centerOffsetX ?? 0}
                    min={-900}
                    max={900}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, centerOffsetX: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="VS offset Y"
                    value={settings.matches.centerOffsetY ?? 0}
                    min={-500}
                    max={500}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        matches: { ...prev.matches, centerOffsetY: value },
                      }))
                    }
                  />
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-surface-elevated/80">
                <CardHeader>
                  <CardTitle className="text-lg">Team Points</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SliderInput
                    label="Points offset X"
                    value={settings.leaderboard.statOffsetX ?? 0}
                    min={-900}
                    max={900}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        leaderboard: { ...prev.leaderboard, statOffsetX: value },
                      }))
                    }
                  />

                  <SliderInput
                    label="Points offset Y"
                    value={settings.leaderboard.statOffsetY ?? 0}
                    min={-500}
                    max={500}
                    onChange={(value) =>
                      updateSettings((prev) => ({
                        ...prev,
                        leaderboard: { ...prev.leaderboard, statOffsetY: value },
                      }))
                    }
                  />
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button onClick={() => void handleSave()} disabled={saving || loadingOverlayData}>
                  {saving ? "Saving..." : "Save overlay"}
                </Button>
                {message ? <span className="text-sm text-muted">{message}</span> : null}
              </div>
            </div>

            {/* Right Column: Preview */}
            <div className="flex flex-col">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle className="text-lg">Live Preview</CardTitle>
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
          </div>
        )}
      </div>
    </main>
  );
}
