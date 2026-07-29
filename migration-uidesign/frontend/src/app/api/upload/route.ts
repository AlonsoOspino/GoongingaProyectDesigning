import { put, del } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com'

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

export async function POST(request: NextRequest) {
  try {
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
