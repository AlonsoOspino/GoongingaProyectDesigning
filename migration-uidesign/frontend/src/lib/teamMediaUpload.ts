export type TeamMediaUploadType = "logo" | "roster";

export async function uploadTeamMedia(file: File, type: TeamMediaUploadType): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.url) {
    const message = data?.error || "Image upload failed";
    throw new Error(message);
  }

  return data.url as string;
}