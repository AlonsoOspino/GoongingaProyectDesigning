import { redirect } from "next/navigation";

export default function StandingsRedirect() {
  redirect("/history?tab=standings");
}
