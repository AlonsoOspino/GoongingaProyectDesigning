import { del, list, put, type ListBlobResultBlob } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DOCUMENT_PREFIX = "examen/current/";
const DEFAULT_MAX_FILE_MB = 20;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

type SharedDocument = {
  fileName: string;
  url: string;
  downloadUrl: string;
  pathname: string;
  size: number;
  uploadedAt: string;
};

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function isPdf(file: File) {
  return file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf");
}

function isDocx(file: File) {
  return file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
}

function safeFileName(fileName: string) {
  const fallback = "documento";
  const cleaned = fileName
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return cleaned || fallback;
}

function fileNameFromPathname(pathname: string) {
  const leaf = pathname.split("/").pop() || "documento";

  return leaf.replace(/^\d+-/, "");
}

function toSharedDocument(blob: ListBlobResultBlob): SharedDocument {
  return {
    fileName: fileNameFromPathname(blob.pathname),
    url: blob.url,
    downloadUrl: blob.downloadUrl,
    pathname: blob.pathname,
    size: blob.size,
    uploadedAt: blob.uploadedAt.toISOString(),
  };
}

async function getCurrentBlobs() {
  const result = await list({ prefix: DOCUMENT_PREFIX });

  return result.blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

export async function GET() {
  if (!hasBlobToken()) {
    return NextResponse.json({ error: "Falta BLOB_READ_WRITE_TOKEN en el entorno." }, { status: 500 });
  }

  const [currentDocument] = await getCurrentBlobs();

  return NextResponse.json({ document: currentDocument ? toSharedDocument(currentDocument) : null });
}

export async function POST(request: Request) {
  if (!hasBlobToken()) {
    return NextResponse.json({ error: "Falta BLOB_READ_WRITE_TOKEN en el entorno." }, { status: 500 });
  }

  const maxFileMb = Number(process.env.EXAMEN_MAX_FILE_MB || DEFAULT_MAX_FILE_MB);
  const formData = await request.formData();
  const uploadedDocument = formData.get("document");

  if (!(uploadedDocument instanceof File)) {
    return NextResponse.json({ error: "Sube un documento primero." }, { status: 400 });
  }

  if (!isPdf(uploadedDocument) && !isDocx(uploadedDocument)) {
    return NextResponse.json({ error: "Formato no soportado. Usa PDF o Word .docx." }, { status: 415 });
  }

  if (uploadedDocument.size <= 0) {
    return NextResponse.json({ error: "El documento esta vacio." }, { status: 400 });
  }

  if (uploadedDocument.size > maxFileMb * 1024 * 1024) {
    return NextResponse.json({ error: `El documento supera el limite de ${maxFileMb} MB.` }, { status: 413 });
  }

  const existingBlobs = await getCurrentBlobs();

  if (existingBlobs.length > 0) {
    return NextResponse.json({ error: "Ya hay un documento subido. Borralo con X antes de subir otro." }, { status: 409 });
  }

  const pathname = `${DOCUMENT_PREFIX}${Date.now()}-${safeFileName(uploadedDocument.name)}`;
  const blob = await put(pathname, uploadedDocument, {
    access: "public",
    allowOverwrite: true,
    contentType: isPdf(uploadedDocument) ? PDF_MIME : DOCX_MIME,
    cacheControlMaxAge: 60,
  });

  return NextResponse.json({
    document: {
      fileName: fileNameFromPathname(blob.pathname),
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      size: uploadedDocument.size,
      uploadedAt: new Date().toISOString(),
    } satisfies SharedDocument,
  });
}

export async function DELETE() {
  if (!hasBlobToken()) {
    return NextResponse.json({ error: "Falta BLOB_READ_WRITE_TOKEN en el entorno." }, { status: 500 });
  }

  const existingBlobs = await getCurrentBlobs();

  if (existingBlobs.length > 0) {
    await del(existingBlobs.map((blob) => blob.url));
  }

  return NextResponse.json({ success: true });
}
