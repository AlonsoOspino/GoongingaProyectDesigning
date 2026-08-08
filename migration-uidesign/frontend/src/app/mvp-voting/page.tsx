"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { getApiBase, getMvpVoting, voteForMvp, type MvpCampaign, type MvpCandidate } from "@/lib/api";
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

function StatusScreen({ error }: { error: string }) {
  return (
    <main className={styles.statusPage}>
      <section className={styles.statusCard}>
        <div className={styles.statusIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M8 4h8v4c0 4.2-1.7 7-4 8-2.3-1-4-3.8-4-8V4Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 6H5c0 3.7 1.5 5.6 4 5.6M16 6h3c0 3.7-1.5 5.6-4 5.6M12 16v3M9 21h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <p className={styles.statusKicker}>GOONGINGA LEAGUE · GRAND FINALS</p>
        <h1 className={styles.statusTitle}>{error ? "MVP voting is unavailable" : "The ballot is not live yet"}</h1>
        <p className={styles.statusText}>{error || "Voting unlocks when the Grand Finals MVP ballot is ready. Come back when the polls open."}</p>
        <Link href="/" className={styles.statusLink}>BACK HOME</Link>
      </section>
    </main>
  );
}

function WinnerReveal({ winner }: { winner: MvpCandidate }) {
  const image = candidateImage(winner);
  return (
    <section className={styles.winnerSection}>
      <div className={styles.winnerCard}>
        <div className={styles.winnerCrown} aria-hidden="true">♛</div>
        <p className={styles.winnerLabel}>Grand Finals MVP</p>
        <h2 className={styles.winnerName}>{winner.displayName}</h2>
        {image && <div className={styles.winnerImage}><img src={image} alt={winner.displayName} /></div>}
      </div>
    </section>
  );
}

function VoteConfirmation({ candidate, onClose }: { candidate: MvpCandidate; onClose: () => void }) {
  const image = candidateImage(candidate);
  return (
    <div className={styles.confirmationBackdrop} role="dialog" aria-modal="true" aria-labelledby="vote-confirmation-title">
      <section className={styles.confirmation}>
        <div className={styles.sparkles} aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => <span key={index} />)}
        </div>
        <p className={styles.confirmationKicker}>✓ YOUR VOTE IS LOCKED IN</p>
        <h2 id="vote-confirmation-title" className={styles.confirmationTitle}>HAS VOTADO POR<span>{candidate.displayName}</span></h2>
        <div className={styles.confirmationPortrait}>
          <div className={styles.confirmationPortraitInner}>
            {image ? <img src={image} alt={candidate.displayName} /> : <div className={styles.confirmationInitials}>{initials(candidate.displayName)}</div>}
          </div>
        </div>
        <h3 className={styles.confirmationName}>{candidate.displayName}</h3>
        <p className={styles.confirmationText}>Tu voto quedó registrado para el MVP de la Grand Final. Gracias por ser parte de la decisión.</p>
        <div className={styles.confirmationActions}>
          <Link href="/" className={styles.confirmationPrimary}>BACK HOME</Link>
          <button type="button" className={styles.confirmationSecondary} onClick={onClose}>VER CANDIDATOS</button>
        </div>
      </section>
    </div>
  );
}

export default function MvpVotingPage() {
  const [campaign, setCampaign] = useState<MvpCampaign | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getMvpVoting({ cache: "no-store" })
      .then((data) => {
        setCampaign(data.campaign);
        setLoaded(true);
      })
      .catch(() => {
        setError("MVP voting is unavailable right now.");
        setLoaded(true);
      });
  }, []);

  const winner = useMemo(
    () => campaign?.candidates.find((candidate) => candidate.id === campaign.winnerCandidateId) || null,
    [campaign]
  );
  const selectedCandidate = useMemo(
    () => campaign?.candidates.find((candidate) => candidate.id === selected) || null,
    [campaign, selected]
  );

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
      setVoted(true);
      setShowCelebration(true);
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : "Could not submit your vote.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <main className={styles.statusPage}>
        <section className={styles.statusCard}>
          <div className={styles.loadingRing} aria-hidden="true" />
          <p className={styles.statusKicker}>BUILDING THE BALLOT</p>
          <h1 className={styles.statusTitle}>Loading MVP voting…</h1>
        </section>
      </main>
    );
  }

  if (!campaign) return <StatusScreen error={error} />;

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
            {campaign.status === "OPEN" && <span className={styles.liveDot} aria-hidden="true" />}
            {campaign.status === "OPEN" ? "VOTING IS LIVE · GRAND FINALS" : "GRAND FINALS · MVP"}
          </div>
          <h1 className={styles.title}>WHO WAS THE<br /><span className={styles.titleAccent}>MVP?</span></h1>
          <p className={styles.lead}>Five finalists. One championship performance. Pick the player who made the biggest difference when everything was on the line.</p>
          <div className={styles.rules}>
            <span>1 NETWORK MEMBER</span><i aria-hidden="true" /><span>1 VOTE</span><i aria-hidden="true" /><span>1 MVP</span>
          </div>
        </header>

        {campaign.status === "CLOSED" && winner ? (
          <WinnerReveal winner={winner} />
        ) : campaign.status === "CLOSED" ? (
          <section className={styles.statusCard} style={{ margin: "3rem auto 0" }}>
            <p className={styles.statusKicker}>POLLS CLOSED</p>
            <h2 className={styles.statusTitle}>The votes are in.</h2>
            <p className={styles.statusText}>The MVP result has not been published yet.</p>
          </section>
        ) : (
          <>
            <section className={styles.candidateGrid} aria-label="MVP candidates">
              {campaign.candidates.map((candidate, index) => {
                const isSelected = selected === candidate.id;
                const image = candidateImage(candidate);
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
                      {image ? <img src={image} alt={candidate.displayName} className={styles.image} /> : <div className={styles.fallback}>{initials(candidate.displayName)}</div>}
                      <div className={styles.imageShade} aria-hidden="true" />
                      <div className={styles.imageGlow} aria-hidden="true" />
                      <span className={styles.number}>0{index + 1}</span>
                      {isSelected && <span className={styles.selectedMark}><CheckIcon /></span>}
                    </div>
                    <div className={styles.cardCopy}>
                      <p className={styles.cardEyebrow}>Grand Finalist</p>
                      <h2 className={styles.name}>{candidate.displayName}</h2>
                      <div className={styles.cardAction}>
                        <span>{isSelected ? "YOUR PICK" : "SELECT PLAYER"}</span>
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                    </div>
                  </button>
                );
              })}
            </section>

            {voted && selectedCandidate && (
              <div className={styles.votedStrip} role="status">
                <CheckIcon /> Has votado por <strong>{selectedCandidate.displayName}</strong>. Tu voto ya está registrado.
              </div>
            )}
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}
      </div>

      {campaign.status === "OPEN" && !voted && (
        <div className={`${styles.voteDock} ${selectedCandidate ? styles.voteDockReady : ""}`}>
          <div className={styles.pickThumb} aria-hidden="true">
            {selectedCandidate && candidateImage(selectedCandidate)
              ? <img src={candidateImage(selectedCandidate)} alt="" />
              : <div className={styles.pickThumbEmpty}>{selectedCandidate ? initials(selectedCandidate.displayName) : "?"}</div>}
          </div>
          <div className={styles.pickCopy}>
            <p className={styles.pickLabel}>YOUR MVP PICK</p>
            <p className={`${styles.pickName} ${!selectedCandidate ? styles.pickNameEmpty : ""}`}>{selectedCandidate?.displayName || "Select a finalist to continue"}</p>
          </div>
          <button type="button" className={styles.voteButton} disabled={!selectedCandidate || busy} onClick={submitVote}>
            {busy ? <><span className={styles.spinner} aria-hidden="true" />SUBMITTING</> : <>LOCK IN MY VOTE<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></>}
          </button>
        </div>
      )}

      {showCelebration && selectedCandidate && <VoteConfirmation candidate={selectedCandidate} onClose={() => setShowCelebration(false)} />}
    </main>
  );
}
