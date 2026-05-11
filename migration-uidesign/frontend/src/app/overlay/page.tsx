import Link from "next/link";

const SAMPLE_MATCH_ID = 1;

export default function OverlayIndexPage() {
  return (
    <main
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "#101010",
        color: "#f2c47b",
        fontFamily: "var(--font-overlay-body), sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            fontFamily: "var(--font-overlay-display), var(--font-overlay-body), sans-serif",
            fontSize: "3rem",
            marginBottom: "1rem",
            letterSpacing: "0.04em",
          }}
        >
          OBS Overlay Routes
        </h1>
        <p style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>
          Use your match id in one of these URLs:
        </p>
        <p style={{ fontSize: "1.15rem", marginBottom: "0.5rem" }}>
          <Link href={`/overlay/map-pool-clean/${SAMPLE_MATCH_ID}`} style={{ color: "#f4d8a8" }}>
            /overlay/map-pool-clean/[matchId]
          </Link>
        </p>
        <p style={{ fontSize: "1.15rem" }}>
          <Link href={`/overlay/wincards/${SAMPLE_MATCH_ID}`} style={{ color: "#f4d8a8" }}>
            /overlay/wincards/[matchId]
          </Link>
        </p>
        <p style={{ fontSize: "1.15rem" }}>
          <Link href={`/overlay/match-header/${SAMPLE_MATCH_ID}`} style={{ color: "#f4d8a8" }}>
            /overlay/match-header/[matchId]
          </Link>
        </p>
        <p style={{ fontSize: "1.15rem" }}>
          <Link href={`/overlay/match-header-reversed/${SAMPLE_MATCH_ID}`} style={{ color: "#f4d8a8" }}>
            /overlay/match-header-reversed/[matchId]
          </Link>
        </p>
      </div>
    </main>
  );
}
