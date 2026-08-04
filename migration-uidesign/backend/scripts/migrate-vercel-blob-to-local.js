/* eslint-disable no-console */
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const prisma = require("../config/prisma");

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const BLOB_URL_PATTERN = /https:\/\/[a-z0-9][a-z0-9-]*\.public\.blob\.vercel-storage\.com\/[^\s"'<>]+/gi;
const MAX_BLOB_BYTES = 150 * 1024 * 1024;
const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || path.join(__dirname, "../uploads"));
const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const publicBaseArgument = process.argv.find((arg) => arg.startsWith("--public-api-base="));
const PUBLIC_API_BASE_URL = (
  process.env.ASSET_PUBLIC_BASE_URL ||
  publicBaseArgument?.slice("--public-api-base=".length) ||
  ""
).replace(/\/$/, "");

const contentTypeExtensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
  "audio/aac": ".aac",
};

const collections = [
  { model: "team", scalarFields: ["logo", "roster", "bannerLeft", "bannerRight"] },
  { model: "member", scalarFields: ["profilePic", "heroVideoFolderPath"] },
  { model: "networkMember", scalarFields: ["avatarUrl"] },
  { model: "map", scalarFields: ["imgPath"] },
  { model: "hero", scalarFields: ["imgPath", "heroGift"] },
  { model: "news", scalarFields: ["imageUrl", "content"] },
  { model: "leaderboardOverlayAsset", scalarFields: ["backgroundImageUrl"], jsonFields: ["settings"] },
  { model: "wrapped", jsonFields: ["snapshot", "assets"] },
  { model: "familyFeudGame", jsonFields: ["state"] },
  { model: "match", jsonFields: ["mapsAllowedByRound", "mapResults"] },
  { model: "draftTable", jsonFields: ["bannedHeroes", "pickedMaps"] },
];

const copiedUrls = new Map();
const foundUrls = new Set();
const summary = {
  recordsScanned: 0,
  recordsUpdated: 0,
  blobUrlsFound: 0,
  blobsCopied: 0,
  failedRecords: 0,
};

function isVercelBlobUrl(value) {
  try {
    return new URL(value).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

function normalizeBlobUrl(value) {
  // Blob pathnames created by this project contain URL-safe file names. Trim
  // markdown punctuation that can be attached after an inline URL.
  return value.replace(/[.,;:!?\])}]+$/, "");
}

function extensionFor(sourceUrl, contentType) {
  const fromType = contentTypeExtensions[String(contentType || "").split(";")[0].trim().toLowerCase()];
  if (fromType) return fromType;

  try {
    const extension = path.extname(new URL(sourceUrl).pathname).replace(/[^a-z0-9.]/gi, "").toLowerCase();
    if (extension) return extension.slice(0, 12);
  } catch {
    // The caller already validates that this is a Blob URL.
  }
  return ".bin";
}

async function copyBlob(sourceUrl) {
  if (copiedUrls.has(sourceUrl)) return copiedUrls.get(sourceUrl);
  if (!PUBLIC_API_BASE_URL) {
    throw new Error("Set ASSET_PUBLIC_BASE_URL or pass --public-api-base=http://YOUR_SERVER_IP:3000.");
  }

  const response = await fetch(sourceUrl, {
    headers: { "user-agent": "GoongingaBlobToVpsMigration/1.0" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`download failed with HTTP ${response.status}`);

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_BLOB_BYTES) {
    throw new Error(`file is larger than the ${MAX_BLOB_BYTES / 1024 / 1024}MB migration limit`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_BLOB_BYTES) {
    throw new Error(`file is larger than the ${MAX_BLOB_BYTES / 1024 / 1024}MB migration limit`);
  }

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const fileName = `blob-${hash.slice(0, 24)}${extensionFor(sourceUrl, response.headers.get("content-type"))}`;
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.writeFile(path.join(MEDIA_DIR, fileName), buffer, { flag: "w" });

  const localUrl = `${PUBLIC_API_BASE_URL}/uploads/${encodeURIComponent(fileName)}`;
  copiedUrls.set(sourceUrl, localUrl);
  summary.blobsCopied += 1;
  return localUrl;
}

async function replaceBlobUrlsInText(value) {
  if (typeof value !== "string" || !value.includes(BLOB_HOST_SUFFIX)) {
    return { value, changed: false };
  }

  const matches = [...value.matchAll(BLOB_URL_PATTERN)];
  if (matches.length === 0) return { value, changed: false };

  let nextValue = value;
  for (const match of matches) {
    const sourceUrl = normalizeBlobUrl(match[0]);
    if (!isVercelBlobUrl(sourceUrl)) continue;
    foundUrls.add(sourceUrl);
    if (!shouldWrite) continue;
    const localUrl = await copyBlob(sourceUrl);
    nextValue = nextValue.split(sourceUrl).join(localUrl);
  }

  return { value: nextValue, changed: nextValue !== value };
}

async function transformValue(value) {
  if (typeof value === "string") return replaceBlobUrlsInText(value);
  if (Array.isArray(value)) {
    let changed = false;
    const nextValue = [];
    for (const item of value) {
      const result = await transformValue(item);
      nextValue.push(result.value);
      changed ||= result.changed;
    }
    return { value: changed ? nextValue : value, changed };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const nextValue = {};
    for (const [key, item] of Object.entries(value)) {
      const result = await transformValue(item);
      nextValue[key] = result.value;
      changed ||= result.changed;
    }
    return { value: changed ? nextValue : value, changed };
  }
  return { value, changed: false };
}

async function migrateCollection({ model, scalarFields = [], jsonFields = [] }) {
  const select = { id: true };
  for (const field of [...scalarFields, ...jsonFields]) select[field] = true;

  const records = await prisma[model].findMany({ select });
  for (const record of records) {
    summary.recordsScanned += 1;
    const data = {};
    try {
      for (const field of [...scalarFields, ...jsonFields]) {
        const result = await transformValue(record[field]);
        if (result.changed) data[field] = result.value;
      }

      if (Object.keys(data).length > 0) {
        if (shouldWrite) await prisma[model].update({ where: { id: record.id }, data });
        summary.recordsUpdated += 1;
        console.log(`${shouldWrite ? "UPDATED" : "WOULD UPDATE"} ${model}#${record.id}`);
      }
    } catch (error) {
      summary.failedRecords += 1;
      console.error(`FAILED ${model}#${record.id}:`, error instanceof Error ? error.message : error);
    }
  }
}

async function main() {
  if (shouldWrite && !PUBLIC_API_BASE_URL) {
    throw new Error("Use --public-api-base=http://YOUR_SERVER_IP:3000 when writing the migration.");
  }

  console.log(shouldWrite ? "Migrating referenced Vercel Blob files to local VPS storage." : "Dry run: no files or database values will change.");
  for (const collection of collections) await migrateCollection(collection);

  summary.blobUrlsFound = foundUrls.size;
  if (shouldWrite) {
    const manifest = Object.fromEntries(copiedUrls.entries());
    await fs.writeFile(path.join(MEDIA_DIR, "blob-migration-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  console.log("\nSummary");
  console.log(JSON.stringify(summary, null, 2));
  if (!shouldWrite) console.log("Run again with --write after reviewing this result.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
