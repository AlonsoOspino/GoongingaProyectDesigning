import { list } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DOCUMENT_PREFIX = "examen/current/";
const DEFAULT_MAX_FILE_MB = 20;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

async function hasSharedDocument() {
  const result = await list({ prefix: DOCUMENT_PREFIX, limit: 1 });

  return result.blobs.length > 0;
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Falta BLOB_READ_WRITE_TOKEN en el entorno." }, { status: 500 });
  }

  const body = (await request.json()) as HandleUploadBody;
  const maxFileMb = Number(process.env.EXAMEN_MAX_FILE_MB || DEFAULT_MAX_FILE_MB);

  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(DOCUMENT_PREFIX)) {
          throw new Error("Ruta de documento no permitida.");
        }

        if (await hasSharedDocument()) {
          throw new Error("Ya hay un documento compartido. Borralo con X antes de subir otro con S.");
        }

        return {
          allowedContentTypes: [PDF_MIME, DOCX_MIME],
          maximumSizeInBytes: maxFileMb * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 60,
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo preparar la subida compartida.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
