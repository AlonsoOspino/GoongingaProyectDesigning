/* eslint-disable no-console */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { put } = require("@vercel/blob");

const frontendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(frontendRoot, "..");
const backendRoot = path.join(projectRoot, "backend");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(backendRoot, ".env"));
loadEnvFile(path.join(frontendRoot, ".env.local"));

const prisma = require(path.join(backendRoot, "config", "prisma"));

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldForce = args.has("--force");

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const contentTypeToExt = new Map([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isBlobUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function sanitizeSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
}

function inferExt(sourceUrl, contentType) {
  const normalizedType = contentType.split(";")[0].trim().toLowerCase();
  if (contentTypeToExt.has(normalizedType)) return contentTypeToExt.get(normalizedType);

  try {
    const pathname = new URL(sourceUrl).pathname;
    const ext = path.extname(pathname).replace(".", "").toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  } catch {
    // handled by fallback
  }

  return "bin";
}

async function downloadImage(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "GoongingaLeagueBlobMigration/1.0",
      accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`download did not return an image (${contentType})`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error(`image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024}MB`);
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: contentType.split(";")[0].trim().toLowerCase(),
  };
}

async function uploadToBlob({ sourceUrl, folder, owner, field }) {
  const { buffer, contentType } = await downloadImage(sourceUrl);
  const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 14);
  const ext = inferExt(sourceUrl, contentType);
  const pathname = [
    "migrated",
    folder,
    `${sanitizeSegment(owner)}-${field}-${hash}.${ext}`,
  ].join("/");

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });

  return blob.url;
}

function collectJobs({ teams, members }) {
  const jobs = [];

  for (const team of teams) {
    for (const field of ["logo", "roster"]) {
      const value = team[field];
      if (!value) continue;
      jobs.push({
        model: "team",
        id: team.id,
        name: team.name,
        field,
        sourceUrl: value,
        folder: field === "logo" ? "team-logos" : "team-rosters",
      });
    }
  }

  for (const member of members) {
    if (!member.profilePic) continue;
    jobs.push({
      model: "member",
      id: member.id,
      name: member.nickname,
      field: "profilePic",
      sourceUrl: member.profilePic,
      folder: "profile-pictures",
    });
  }

  return jobs;
}

async function updateRecord(job, blobUrl) {
  if (job.model === "team") {
    await prisma.team.update({
      where: { id: job.id },
      data: { [job.field]: blobUrl },
    });
    return;
  }

  await prisma.member.update({
    where: { id: job.id },
    data: { [job.field]: blobUrl },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Put it in backend/.env or the shell environment.");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing. Put it in frontend/.env.local or the shell environment.");
  }

  const [teams, members] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, logo: true, roster: true } }),
    prisma.member.findMany({ select: { id: true, nickname: true, profilePic: true } }),
  ]);

  const jobs = collectJobs({ teams, members });
  const uploadedBySource = new Map();
  const summary = {
    total: jobs.length,
    uploaded: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  console.log(shouldWrite ? "Running Blob migration with DB updates." : "Dry run only. Pass --write to upload and update DB.");
  console.log(`Found ${jobs.length} image field(s) to inspect.\n`);

  for (const job of jobs) {
    const label = `${job.model}#${job.id} ${job.field} (${job.name})`;

    if (!isHttpUrl(job.sourceUrl)) {
      summary.skipped += 1;
      console.log(`SKIP  ${label}: not an http(s) URL`);
      continue;
    }

    if (!shouldForce && isBlobUrl(job.sourceUrl)) {
      summary.skipped += 1;
      console.log(`SKIP  ${label}: already on Vercel Blob`);
      continue;
    }

    if (!shouldWrite) {
      console.log(`WOULD  ${label}: ${job.sourceUrl}`);
      continue;
    }

    try {
      let blobUrl = uploadedBySource.get(job.sourceUrl);
      if (!blobUrl) {
        blobUrl = await uploadToBlob({
          sourceUrl: job.sourceUrl,
          folder: job.folder,
          owner: `${job.model}-${job.id}-${job.name}`,
          field: job.field,
        });
        uploadedBySource.set(job.sourceUrl, blobUrl);
        summary.uploaded += 1;
      }

      await updateRecord(job, blobUrl);
      summary.updated += 1;
      console.log(`OK    ${label}: ${blobUrl}`);
    } catch (error) {
      summary.failed += 1;
      console.log(`FAIL  ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\nSummary");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
