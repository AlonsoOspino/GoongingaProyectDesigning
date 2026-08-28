import { redirect } from "next/navigation";

export default function TeamsRedirect() {
  redirect("/history?tab=rosters");
}
