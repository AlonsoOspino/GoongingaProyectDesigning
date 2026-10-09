import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Overtime Productions — GGL Tournament",
  description:
    "Overwatch tournaments and community game nights.",
};

export default function HomePage() {
  return <LandingPage />;
}
