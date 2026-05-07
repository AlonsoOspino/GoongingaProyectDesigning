import { put, del } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

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

    // Validate file type for images
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Limit file size to 5MB
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit.' },
        { status: 400 }
      )
    }

    // Generate a unique filename with type prefix
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `${sanitizeSegment(type)}-${timestamp}.${extension}`

    // Upload to Vercel Blob (public access for team logos and rosters)
    const blob = await put(filename, file, {
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
