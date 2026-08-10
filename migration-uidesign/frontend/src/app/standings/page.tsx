import { redirect } from "next/navigation";

export default function StandingsRedirect() {
  redirect("/history/season-8?tab=standings");
}
