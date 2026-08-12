import { notFound } from "next/navigation";
import { JeopardyOrderPreview } from "@/minigames/JeopardyOrderPreview";

export default function JeopardyOrderPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <JeopardyOrderPreview />;
}
