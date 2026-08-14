import type { Metadata } from "next";
import { QuestionAdminPage } from "@/features/networkFeud/QuestionAdminPage";

export const metadata: Metadata = { title: "Family Feud Questions" };
export default function NetworkFeudQuestionAdminRoute() { return <QuestionAdminPage />; }
