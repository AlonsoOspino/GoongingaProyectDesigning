const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

function extractFileName(pathValue: string): string {
  const cleaned = pathValue.split("?")[0].split("#")[0];
  const parts = cleaned.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function toAbsoluteBackendUrl(pathValue: string): string {
  if (/^https?:\/\//i.test(pathValue)) {
    return pathValue;
  }
  if (pathValue.startsWith("/")) {
    return `${API_BASE}${pathValue}`;
  }
  return `${API_BASE}/${pathValue}`;
}

export function resolveMapImageUrl(imgPath?: string | null): string {
  if (!imgPath) return "";

  if (imgPath.startsWith("/MapImages/")) {
    const fileName = extractFileName(imgPath);
    return `${API_BASE}/assets/maps/${encodeURIComponent(fileName)}`;
  }

  if (imgPath.startsWith("/assets/maps/")) {
    return `${API_BASE}${imgPath}`;
  }

  if (/^https?:\/\//i.test(imgPath)) {
    return imgPath;
  }

  const fileName = extractFileName(imgPath);
  return `${API_BASE}/assets/maps/${encodeURIComponent(fileName)}`;
}

export function resolveHeroImageUrl(imgPath?: string | null): string {
  if (!imgPath) return "";

  if (imgPath.startsWith("/HeroImages/")) {
    const fileName = extractFileName(imgPath);
    return `${API_BASE}/assets/heroes/${encodeURIComponent(fileName)}`;
  }

  if (imgPath.startsWith("/assets/heroes/")) {
    return `${API_BASE}${imgPath}`;
  }

  if (/^https?:\/\//i.test(imgPath)) {
    return imgPath;
  }

  const fileName = extractFileName(imgPath);
  return `${API_BASE}/assets/heroes/${encodeURIComponent(fileName)}`;
}

export function resolveGenericBackendAsset(pathValue?: string | null): string {
  if (!pathValue) return "";
  return toAbsoluteBackendUrl(pathValue);
}

export function resolveHeroVideoPath(folderPath?: string | null, videoName?: string): string {
  if (!folderPath || !videoName) return "";
  
  // Construct the path with proper formatting
  // Assuming folderPath is something like "C:/folder/path" or "/path/to/folder"
  // and videoName is like "hero_video_a.mp4"
  const normalizedFolder = folderPath.replace(/\\/g, "/");
  const cleanFolder = normalizedFolder.endsWith("/") ? normalizedFolder.slice(0, -1) : normalizedFolder;
  return `${cleanFolder}/${videoName}`;
}
