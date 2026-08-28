import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Overtime Productions — The official home of Goonginga League",
  description:
    "A very active community that hosts streams & events of many games like Overwatch, Deadlock, League of Legends and more. Home of Goonginga League Season 9.",
};

export default function HomePage() {
  return <LandingPage />;
}
