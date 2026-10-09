import CurrentSeasonView from "@/components/season/CurrentSeasonView";

export const metadata = { title: "Season 9 — Standings" };

export default function StandingsPage() {
  return <CurrentSeasonView view="standings" />;
}
