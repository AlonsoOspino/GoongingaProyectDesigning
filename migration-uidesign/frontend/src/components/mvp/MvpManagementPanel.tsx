"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  getMvpManage,
  publishMvpWinner,
  updateMvpStatus,
  uploadMvpImage,
  type MvpCampaign,
} from "@/lib/api";

type MvpManagementPanelProps = {
  token: string;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 401) {
    return "Your manager session expired. Please sign in again.";
  }
  return error instanceof Error ? error.message : fallback;
}

export function MvpManagementPanel({ token }: MvpManagementPanelProps) {
  const [campaign, setCampaign] = useState<MvpCampaign | null>(null);
  const [message, setMessage] = useState("Loading MVP campaign...");
  const [notice, setNotice] = useState("");
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when the server reports a tie or a zero-vote ballot, which requires the
  // manager to choose the winner explicitly before the reveal.
  const [manualPick, setManualPick] = useState<{ reason: string; tiedIds: number[] } | null>(null);

  const load = useCallback(async () => {
    const sessionToken = token.trim();

    if (!sessionToken) {
      setCampaign(null);
      setMessage("Your manager session is not ready. Please sign in again.");
      return;
    }

    try {
      const data = await getMvpManage(sessionToken);
      setCampaign(data.campaign);
      setMessage(
        data.reason || (data.campaign ? "" : "No finished Grand Finals campaign yet.")
      );
    } catch (error) {
      setMessage(errorMessage(error, "Could not load MVP campaign."));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keeps the live vote counts moving during the broadcast without the manager
  // having to reload the dashboard.
  useEffect(() => {
    if (campaign?.status !== "OPEN") return;

    const timer = window.setInterval(() => {
      void load();
    }, 10000);

    return () => window.clearInterval(timer);
  }, [campaign?.status, load]);

  async function status(nextStatus: "OPEN" | "CLOSED") {
    setBusy(true);
    setNotice("");
    try {
      await updateMvpStatus(token.trim(), nextStatus);
      setNotice(nextStatus === "OPEN" ? "Voting is now open." : "Voting is now closed.");
      await load();
    } catch (error) {
      setNotice(errorMessage(error, "Could not update voting."));
    } finally {
      setBusy(false);
    }
  }

  async function upload(candidateId: number, file?: File) {
    if (!file) return;

    // Validated here so the manager gets an instant answer instead of waiting
    // for the request to fail.
    if (!file.type.startsWith("image/")) {
      setNotice("That file is not an image.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setNotice("That image is larger than 5 MB. Use a smaller file.");
      return;
    }

    setUploadingId(candidateId);
    setNotice("");
    try {
      await uploadMvpImage(token.trim(), candidateId, file);
      setNotice("Photo updated and cropped to the broadcast format.");
      await load();
    } catch (error) {
      setNotice(errorMessage(error, "Could not upload image."));
    } finally {
      setUploadingId(null);
    }
  }

  async function publish(candidateId?: number) {
    setBusy(true);
    setNotice("");
    try {
      await publishMvpWinner(token.trim(), candidateId);
      setManualPick(null);
      setNotice("Winner published. The MVP reveal is now live.");
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const payload = error.data as
          | { message?: string; needsManualPick?: boolean; tiedCandidateIds?: number[] }
          | undefined;

        if (payload?.needsManualPick) {
          setManualPick({
            reason: payload.message || "Pick the winner manually.",
            tiedIds: payload.tiedCandidateIds || [],
          });
          setBusy(false);
          return;
        }
      }
      setNotice(errorMessage(error, "Could not publish winner."));
    } finally {
      setBusy(false);
    }
  }

  const totalVotes =
    campaign?.candidates.reduce((sum, item) => sum + (item.voteCount || 0), 0) || 0;
  const published = Boolean(campaign?.publishedAt);
  const missingPhotos = campaign?.candidates.filter((item) => !item.imageUrl).length || 0;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="primary">GRAND FINALS FEATURE</Badge>
          <h2 className="mt-3 text-2xl font-bold">MVP Voting</h2>
          <p className="mt-1 text-sm text-muted">
            Candidates are locked to the five members of the winning team.
          </p>
        </div>

        {campaign && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || published}
              onClick={() => status(campaign.status === "OPEN" ? "CLOSED" : "OPEN")}
            >
              {campaign.status === "OPEN" ? "Close voting" : "Open voting"}
            </Button>

            <Button size="sm" onClick={() => publish()} disabled={busy || published}>
              {published ? "Winner published" : "Publish winner"}
            </Button>
          </div>
        )}
      </div>

      {message && !campaign ? (
        <p className="mt-8 text-sm text-muted">{message}</p>
      ) : (
        campaign && (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-mono text-sm text-primary">
                STATUS: {published ? "REVEALED" : campaign.status}
              </span>
              <span className="text-sm text-muted">{totalVotes} total votes</span>
              {missingPhotos > 0 && (
                <span className="text-sm text-amber-400">
                  {missingPhotos} candidate{missingPhotos === 1 ? "" : "s"} without a photo
                </span>
              )}
            </div>

            {published && (
              <p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted">
                The MVP has been revealed on stream, so this election is now locked.
              </p>
            )}

            {notice && <p className="mt-3 text-sm text-primary">{notice}</p>}

            {manualPick && (
              <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
                <p className="text-sm font-semibold text-amber-400">{manualPick.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {campaign.candidates
                    .filter(
                      (item) =>
                        manualPick.tiedIds.length === 0 || manualPick.tiedIds.includes(item.id)
                    )
                    .map((item) => (
                      <Button
                        key={item.id}
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => publish(item.id)}
                      >
                        Crown {item.displayName}
                      </Button>
                    ))}
                  <Button size="sm" variant="ghost" onClick={() => setManualPick(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {campaign.candidates.map((candidate) => {
                const isWinner = campaign.winnerCandidateId === candidate.id;
                const share = totalVotes
                  ? Math.round(((candidate.voteCount || 0) / totalVotes) * 100)
                  : 0;

                return (
                  <div
                    key={candidate.id}
                    className={`overflow-hidden rounded-xl border bg-background ${
                      isWinner ? "border-primary" : "border-border"
                    }`}
                  >
                    {/* Matches the 4:5 ratio the server crops to, so this preview
                        is exactly what viewers and the reveal will see. */}
                    <div className="relative aspect-[4/5] bg-card">
                      {candidate.imageUrl ? (
                        <img
                          src={resolveGenericBackendAsset(candidate.imageUrl)}
                          alt={candidate.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted">
                          No photo yet
                        </div>
                      )}

                      {uploadingId === candidate.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-xs font-semibold">
                          Uploading...
                        </div>
                      )}

                      {isWinner && (
                        <span className="absolute left-2 top-2 rounded bg-primary px-2 py-1 font-mono text-[10px] font-bold text-background">
                          MVP
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 p-3">
                      <p className="truncate font-semibold" title={candidate.displayName}>
                        {candidate.displayName}
                      </p>
                      <div>
                        <p className="text-xs text-muted">
                          {candidate.voteCount || 0} votes · {share}%
                        </p>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
                          <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                        </div>
                      </div>

                      <label
                        className={`block rounded-md border border-border px-3 py-2 text-center text-xs ${
                          uploadingId === candidate.id
                            ? "cursor-wait opacity-60"
                            : "cursor-pointer hover:border-primary"
                        }`}
                      >
                        {candidate.imageUrl ? "Replace photo" : "Upload photo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={uploadingId === candidate.id}
                          onChange={(event) => {
                            upload(candidate.id, event.target.files?.[0]);
                            // Allows re-selecting the same file after a failure.
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-muted">
              Photos are automatically cropped to a 4:5 portrait centred on the player, so any
              image size works.
            </p>
          </>
        )
      )}
    </Card>
  );
}
