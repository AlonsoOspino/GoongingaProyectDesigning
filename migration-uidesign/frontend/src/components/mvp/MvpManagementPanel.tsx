"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useSession } from "@/features/session/SessionProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getMvpManage, publishMvpWinner, updateMvpStatus, uploadMvpImage, type MvpCampaign } from "@/lib/api";

export function MvpManagementPanel() {
  const { token, isHydrated } = useSession();
  const [campaign, setCampaign] = useState<MvpCampaign | null>(null);
  const [message, setMessage] = useState("Loading MVP campaign...");
  const load = useCallback(async () => {
    const sessionToken = token?.trim() || "";
    if (!isHydrated || !sessionToken) {
      setCampaign(null);
      setMessage("Your manager session is not ready. Please sign in again.");
      return;
    }

    try {
      const data = await getMvpManage(sessionToken);
      setCampaign(data.campaign);
      setMessage(data.reason || (data.campaign ? "" : "No finished Grand Finals campaign yet."));
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 401
        ? "Your manager session expired. Please sign in again."
        : error instanceof Error ? error.message : "Could not load MVP campaign.");
    }
  }, [isHydrated, token]);
  useEffect(() => { void load(); }, [load]);
  async function status(status: "OPEN" | "CLOSED") { try { await updateMvpStatus(token?.trim() || "", status); await load(); } catch (error) { setMessage(error instanceof ApiError && error.status === 401 ? "Your manager session expired. Please sign in again." : error instanceof Error ? error.message : "Could not update voting."); } }
  async function upload(candidateId: number, file?: File) { if (!file) return; try { await uploadMvpImage(token?.trim() || "", candidateId, file); await load(); } catch (error) { setMessage(error instanceof ApiError && error.status === 401 ? "Your manager session expired. Please sign in again." : error instanceof Error ? error.message : "Could not upload image."); } }
  async function publish() { try { await publishMvpWinner(token?.trim() || ""); await load(); } catch (error) { setMessage(error instanceof ApiError && error.status === 401 ? "Your manager session expired. Please sign in again." : error instanceof Error ? error.message : "Could not publish winner."); } }
  return <Card className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge variant="primary">GRAND FINALS FEATURE</Badge><h2 className="mt-3 text-2xl font-bold">MVP Voting</h2><p className="mt-1 text-sm text-muted">Candidates are locked to the five members of the winning team.</p></div>{campaign && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => status(campaign.status === "OPEN" ? "CLOSED" : "OPEN")}>{campaign.status === "OPEN" ? "Close voting" : "Open voting"}</Button><Button size="sm" onClick={publish} disabled={campaign.status === "DRAFT"}>Publish winner</Button></div>}</div>{message && !campaign ? <p className="mt-8 text-sm text-muted">{message}</p> : campaign && <><div className="mt-6 flex items-center gap-3"><span className="font-mono text-sm text-primary">STATUS: {campaign.status}</span><span className="text-sm text-muted">{campaign.candidates.reduce((sum, item) => sum + (item.voteCount || 0), 0)} total votes</span></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{campaign.candidates.map((candidate) => <div key={candidate.id} className="overflow-hidden rounded-xl border border-border bg-background"><div className="aspect-[4/5] bg-card">{candidate.imageUrl && <img src={candidate.imageUrl} alt={candidate.displayName} className="h-full w-full object-cover" />}</div><div className="space-y-3 p-3"><p className="font-semibold">{candidate.displayName}</p><p className="text-xs text-muted">{candidate.voteCount || 0} votes</p><label className="block cursor-pointer rounded-md border border-border px-3 py-2 text-center text-xs hover:border-primary">Replace image<input type="file" accept="image/*" className="sr-only" onChange={(event) => upload(candidate.id, event.target.files?.[0])} /></label></div></div>)}</div></>}</Card>;
}
