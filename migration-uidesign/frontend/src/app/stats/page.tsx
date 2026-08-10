import { redirect } from "next/navigation";

export default function StatsRedirect() {
  redirect("/history/season-8?tab=players");
}
