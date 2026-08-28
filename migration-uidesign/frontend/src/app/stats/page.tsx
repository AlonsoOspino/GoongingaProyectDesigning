import { redirect } from "next/navigation";

export default function StatsRedirect() {
  redirect("/history?tab=players");
}
