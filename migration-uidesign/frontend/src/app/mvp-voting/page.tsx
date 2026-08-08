"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  getApiBase,
  getMvpVoting,
  getMyMvpVote,
  voteForMvp,
  type MvpCampaign,
  type MvpCandidate,
} from "@/lib/api";
import { readNetworkSessionToken } from "@/features/networkSession/storage";
import { resolveGenericBackendAsset } from "@/lib/assetUrls";
import styles from "./mvp-voting.module.css";

function candidateImage(candidate?: MvpCandidate | null) {
  return resolveGenericBackendAsset(candidate?.imageUrl || "");
}

function initials(name?: string) {
  return (name || "MVP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Renders the candidate photo with an initials fallback.
 *
 * A missing or broken upload previously left an empty black box on stream
 * because nothing handled the image error.
 */
function CandidatePhoto({
  candidate,
  className,
  fallbackClassName,
}: {
  candidate: MvpCandidate;
  className: string;
  fallbackClassName: string;
}) {
  const [failed, setFailed] = useState(false);
  const image = candidateImage(candidate);

  if (!image || failed) {
    return <div className={fallbackClassName}>{initials(candidate.displayName)}</div>;
  }

  return (
    <img
      src={image}
      alt={candidate.displayName}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function StatusScreen({ title, text, kicker }: { title: string; text: string; kicker: string }) {
  return (
    <main className={styles.statusPage}>
      <section className={styles.statusCard}>
        <div className={styles.statusIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M8 4h8v4c0 4.2-1.7 7-4 8-2.3-1-4-3.8-4-8V4Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 6H5c0 3.7 1.5 5.6 4 5.6M16 6h3c0 3.7-1.5 5.6-4 5.6M12 16v3M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <p className={styles.statusKicker}>{kicker}</p>
        <h1 className={styles.statusTitle}>{title}</h1>
        <p className={styles.statusText}>{text}</p>
        <Link href="/" className={styles.statusLink}>BACK HOME</Link>
      </section>
    </main>
  );
}

/**
 * Broadcast-safe MVP reveal.
 *
 * This is rendered as its own full-viewport screen instead of a section inside
 * the normal page. Previously the reveal sat below the topbar and the oversized
 * "WHO WAS THE MVP?" hero, which pushed the winner card off the bottom of a
 * 1920x1080 OBS capture. Everything here is sized in viewport units so the
 * composition always fits one screen exactly, with no scrolling.
 */
function WinnerReveal({ winner }: { winner: MvpCandidate }) {
  return (
    <main className={styles.revealPage}>
      <div className={styles.revealGlow} aria-hidden="true" />
      <div className={styles.revealRays} aria-hidden="true" />

      <div className={styles.revealInner}>
        <figure className={styles.revealPortrait}>
          <CandidatePhoto
            candidate={winner}
            className={styles.revealImage}
            fallbackClassName={styles.revealInitials}
          />
          <span className={styles.revealPortraitRing} aria-hidden="true" />
        </figure>

        <div className={styles.revealCopy}>
          <p className={styles.revealKicker}>
            <span className={styles.revealKickerLine} aria-hidden="true" />
            Grand Final MVP
          </p>
          <h1 className={styles.revealName}>{winner.displayName}</h1>
          <p className={styles.revealSub}>Voted by the Goonginga community</p>
        </div>
      </div>

      <Link href="/" className={styles.revealHome}>BACK HOME</Link>
    </main>
  );
}

function VoteConfirmation({ candidate, onClose }: { candidate: MvpCandidate; onClose: () => void }) {
  return (
    <div className={styles.confirmationBackdrop} role="dialog" aria-modal="true" aria-labelledby="vote-confirmation-title">
      <section className={styles.confirmation}>
        <div className={styles.sparkles} aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => <span key={index} />)}
        </div>
        <p className={styles.confirmationKicker}>VOTE COUNTED</p>
        <h2 id="vote-confirmation-title" className={styles.confirmationTitle}>You voted for<span>{candidate.displayName}</span></h2>
        <div className={styles.confirmationPortrait}>
          <div className={styles.confirmationPortraitInner}>
            <CandidatePhoto
              candidate={candidate}
              className={styles.confirmationImage}
              fallbackClassName={styles.confirmationInitials}
            />
          </div>
        </div>
        <h3 className={styles.confirmationName}>{candidate.displayName}</h3>
        <p className={styles.confirmationText}>That&apos;s your one vote for the Grand Final MVP. The winner is revealed live on stream.</p>
        <div className={styles.confirmationActions}>
          <Link href="/" className={styles.confirmationPrimary}>BACK HOME</Link>
          <button type="button" className={styles.confirmationSecondary} onClick={onClose}>BACK TO CANDIDATES</button>
        </div>
      </section>
    </div>
  );
}

export default function MvpVotingPage() {
  const [campaign, setCampaign] = useState<MvpCampaign | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [votedFor, setVotedFor] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getMvpVoting({ cache: "no-store" });
      setCampaign(data.campaign);

      // Restore the viewer's existing vote from the server so a page reload no
      // longer presents a ballot they have already used.
      const token = readNetworkSessionToken();
      if (token && data.campaign) {
        try {
          const mine = await getMyMvpVote(token);
          if (mine.hasVoted) {
            setVotedFor(mine.candidateId);
            setSelected(mine.candidateId);
          }
        } catch {
          // A failed lookup must not block the ballot; the server still rejects
          // duplicate votes.
        }
      }
    } catch {
      setUnavailable(true);
      setError("MVP voting is unavailable right now.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keeps the page in sync with the manager panel during the broadcast, so
  // opening the vote or revealing the winner lands without a manual reload.
  useEffect(() => {
    const timer = window.setInterval(() => {
      getMvpVoting({ cache: "no-store" })
        .then((data) => setCampaign(data.campaign))
        .catch(() => undefined);
    }, 15000);

    return () => window.clearInterval(timer);
  }, []);

  const winner = useMemo(
    () => campaign?.candidates.find((candidate) => candidate.id === campaign.winnerCandidateId) || null,
    [campaign]
  );
  const selectedCandidate = useMemo(
    () => campaign?.candidates.find((candidate) => candidate.id === selected) || null,
    [campaign, selected]
  );
  const votedCandidate = useMemo(
    () => campaign?.candidates.find((candidate) => candidate.id === votedFor) || null,
    [campaign, votedFor]
  );

  const voted = votedFor !== null;
  const isOpen = campaign?.status === "OPEN";

  async function submitVote() {
    const token = readNetworkSessionToken();
    if (!token) {
      window.location.href = `${getApiBase()}/network-auth/discord?return_to=${encodeURIComponent(`${window.location.origin}/mvp-voting`)}`;
      return;
    }
    if (!selected || voted) return;

    setBusy(true);
    setError("");
    try {
      await voteForMvp(token, selected);
      setVotedFor(selected);
      setShowCelebration(true);
    } catch (voteError) {
      const message = voteError instanceof Error ? voteError.message : "Could not submit your vote.";
      setError(message);
      // The ballot may have closed or already been used while the page was open.
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <main className={styles.statusPage}>
        <section className={styles.statusCard}>
          <div className={styles.loadingRing} aria-hidden="true" />
          <p className={styles.statusKicker}>GOONGINGA LEAGUE</p>
          <h1 className={styles.statusTitle}>Loading the MVP vote…</h1>
        </section>
      </main>
    );
  }

  if (unavailable || !campaign) {
    return (
      <StatusScreen
        kicker="GOONGINGA LEAGUE · GRAND FINAL"
        title={unavailable ? "MVP voting is unavailable" : "The MVP vote isn't open yet"}
        text={
          error ||
          "Voting opens right after the Grand Final ends. Check back in a few minutes."
        }
      />
    );
  }

  // The winner reveal replaces the whole page so it always fits a 1080p capture.
  if (campaign.status === "CLOSED" && winner) {
    return <WinnerReveal winner={winner} />;
  }

  if (campaign.status === "DRAFT") {
    return (
      <StatusScreen
        kicker="GOONGINGA LEAGUE · GRAND FINAL"
        title="The MVP vote isn't open yet"
        text="The finalists are locked in. Voting opens as soon as the Grand Final wraps up."
      />
    );
  }

  if (campaign.status === "CLOSED") {
    return (
      <StatusScreen
        kicker="VOTING CLOSED"
        title="The votes are in"
        text="The MVP is about to be revealed live on stream. Stay tuned."
      />
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.noise} aria-hidden="true" />
      <div className={styles.orbOne} aria-hidden="true" />
      <div className={styles.orbTwo} aria-hidden="true" />

      <nav className={styles.topbar} aria-label="MVP voting navigation">
        <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true" />GOONGINGA LEAGUE</div>
        <Link href="/" className={styles.back}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H6M11 7l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          HOME
        </Link>
      </nav>

      <div className={styles.content}>
        <header className={styles.hero}>
          <div className={styles.kicker}>
            <span className={styles.liveDot} aria-hidden="true" />
            VOTING IS LIVE · GRAND FINAL
          </div>
          <h1 className={styles.title}>WHO WAS THE<br /><span className={styles.titleAccent}>MVP?</span></h1>
          <p className={styles.lead}>Pick the player who made the difference in the Grand Final.</p>
          <div className={styles.rules}>
            <span>One vote per account</span>
            <i aria-hidden="true" />
            <span>Discord sign-in required</span>
            <i aria-hidden="true" />
            <span>Winner revealed on stream</span>
          </div>
        </header>

        <section className={styles.candidateGrid} aria-label="MVP candidates">
          {campaign.candidates.map((candidate, index) => {
            const isSelected = selected === candidate.id;
            return (
              <button
                type="button"
                key={candidate.id}
                aria-pressed={isSelected}
                disabled={voted}
                onClick={() => !voted && setSelected(candidate.id)}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
                style={{ "--delay": `${index * 75}ms` } as CSSProperties}
              >
                <div className={styles.imageWrap}>
                  <CandidatePhoto
                    candidate={candidate}
                    className={styles.image}
                    fallbackClassName={styles.fallback}
                  />
                  <div className={styles.imageShade} aria-hidden="true" />
                  <div className={styles.imageGlow} aria-hidden="true" />
                  <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                  {isSelected && <span className={styles.selectedMark}><CheckIcon /></span>}
                </div>
                <div className={styles.cardCopy}>
                  <p className={styles.cardEyebrow}>Grand Finalist</p>
                  <h2 className={styles.name}>{candidate.displayName}</h2>
                  <div className={styles.cardAction}>
                    <span>{isSelected ? (voted ? "YOUR VOTE" : "YOUR PICK") : "SELECT"}</span>
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        {voted && votedCandidate && (
          <div className={styles.votedStrip} role="status">
            <CheckIcon /> You voted for <strong>{votedCandidate.displayName}</strong>. Your vote is locked.
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>

      {isOpen && !voted && (
        <div className={`${styles.voteDock} ${selectedCandidate ? styles.voteDockReady : ""}`}>
          <div className={styles.pickThumb} aria-hidden="true">
            {selectedCandidate && candidateImage(selectedCandidate)
              ? <img src={candidateImage(selectedCandidate)} alt="" />
              : <div className={styles.pickThumbEmpty}>{selectedCandidate ? initials(selectedCandidate.displayName) : "?"}</div>}
          </div>
          <div className={styles.pickCopy}>
            <p className={styles.pickLabel}>YOUR MVP PICK</p>
            <p className={`${styles.pickName} ${!selectedCandidate ? styles.pickNameEmpty : ""}`}>{selectedCandidate?.displayName || "Pick a finalist to continue"}</p>
          </div>
          <button type="button" className={styles.voteButton} disabled={!selectedCandidate || busy} onClick={submitVote}>
            {busy ? <><span className={styles.spinner} aria-hidden="true" />SENDING</> : <>SUBMIT VOTE<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></>}
          </button>
        </div>
      )}

      {showCelebration && votedCandidate && <VoteConfirmation candidate={votedCandidate} onClose={() => setShowCelebration(false)} />}
    </main>
  );
}
