import { put, del } from '@vercel/blob'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { type NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com'
const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "")

type MediaType = "video" | "audio"
type MediaRule = { allowedContentTypes: string[]; maximumSizeInBytes: number }

const MEDIA_RULES: Record<MediaType, MediaRule> = {
  video: {
    allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
    maximumSizeInBytes: 100 * 1024 * 1024,
  },
  audio: {
    allowedContentTypes: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/aac"],
    maximumSizeInBytes: 25 * 1024 * 1024,
  },
}

function isVercelBlobUrl(value: string) {
  try {
    return new URL(value).hostname.endsWith(BLOB_HOST_SUFFIX)
  } catch {
    return false
  }
}

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image'
}

async function normalizeLogoFile(file: File) {
  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const outputBuffer = await sharp(inputBuffer, { failOn: 'none' })
    .resize({
      width: 1024,
      height: 1024,
      fit: 'cover',
      position: 'centre',
      withoutEnlargement: false,
    })
    .webp({ quality: 92 })
    .toBuffer()

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'logo'
  return new File([outputBuffer], `${baseName}.webp`, { type: 'image/webp' })
}

function getMediaType(clientPayload: string | null): MediaType {
  try {
    const payload = JSON.parse(clientPayload || "{}") as { type?: unknown }
    if (payload.type === "video" || payload.type === "audio") return payload.type
  } catch {
    // The generic error below avoids exposing token-generation details.
  }
  throw new Error("Unsupported media upload.")
}

async function requireWrappedManager(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  if (!authorization) {
    return NextResponse.json({ error: "Sign in as a manager or admin to upload media." }, { status: 401 })
  }

  const response = await fetch(`${API_BASE}/wrapped/manage`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  })
  if (response.ok) return null

  return NextResponse.json(
    { error: response.status === 403 ? "Managers and admins only." : "Your session is no longer valid." },
    { status: response.status === 403 ? 403 : 401 }
  )
}

async function handleDirectMediaUpload(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Missing BLOB_READ_WRITE_TOKEN. Restart the server after setting it." }, { status: 500 })
  }

  const body = await request.json() as HandleUploadBody
  if (body.type === "blob.generate-client-token") {
    const denied = await requireWrappedManager(request)
    if (denied) return denied
  }

  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const type = getMediaType(clientPayload)
      if (!pathname.startsWith(`wrapped/${type}/`)) {
        throw new Error("Invalid media upload path.")
      }

      return { ...MEDIA_RULES[type], addRandomSuffix: true }
    },
  })

  return NextResponse.json(response)
}

export async function POST(request: NextRequest) {
  try {
    // Videos/audio use the Blob client protocol. Its small JSON request gets a
    // signed upload token; the large file never traverses this Next.js route.
    if (request.headers.get("content-type")?.includes("application/json")) {
      return await handleDirectMediaUpload(request)
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Missing BLOB_READ_WRITE_TOKEN. Restart the dev server after setting .env.local.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = String(formData.get('type') || 'image')
    const previousUrl = String(formData.get('previousUrl') || '')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime']
    const allowedAudioTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/aac']
    const isVideo = type === 'video'
    const isAudio = type === 'audio'
    const allowedTypes = isVideo ? allowedVideoTypes : isAudio ? allowedAudioTypes : allowedImageTypes

    if (!allowedTypes.includes(file.type)) {
      const expected = isVideo
        ? 'MP4, WebM, and MOV videos'
        : isAudio
        ? 'MP3, M4A, WAV, OGG, AAC, and WebM audio'
        : 'JPEG, PNG, GIF, and WebP images'
      return NextResponse.json(
        { error: `Invalid file type. Only ${expected} are allowed.` },
        { status: 400 }
      )
    }

    const maxSize = isVideo ? 100 * 1024 * 1024 : isAudio ? 25 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      const limit = isVideo ? '100MB' : isAudio ? '25MB' : '5MB'
      return NextResponse.json({ error: `File size exceeds ${limit} limit.` }, { status: 400 })
    }

    const uploadFile = type === 'logo' ? await normalizeLogoFile(file) : file

    // Generate a unique filename with type prefix
    const timestamp = Date.now()
    const extension = uploadFile.name.split('.').pop() || 'bin'
    const filename = `${sanitizeSegment(type)}-${timestamp}.${extension}`

    // Upload to Vercel Blob (public access for team logos and rosters)
    const blob = await put(filename, uploadFile, {
      access: 'public',
    })

    if (previousUrl && previousUrl !== blob.url && isVercelBlobUrl(previousUrl)) {
      await del(previousUrl).catch((error) => {
        console.warn('Old blob delete failed after replacement upload:', error)
      })
    }

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('Upload error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Missing BLOB_READ_WRITE_TOKEN. Restart the dev server after setting .env.local.' },
        { status: 500 }
      )
    }

    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    if (!isVercelBlobUrl(url)) {
      return NextResponse.json({ success: true, skipped: true })
    }

    await del(url)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    const message = error instanceof Error ? error.message : 'Delete failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
