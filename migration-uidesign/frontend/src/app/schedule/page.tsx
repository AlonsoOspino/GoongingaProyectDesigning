import { redirect } from "next/navigation";

export default function ScheduleRedirect() {
  redirect("/history/season-8?tab=playoffs");
}
