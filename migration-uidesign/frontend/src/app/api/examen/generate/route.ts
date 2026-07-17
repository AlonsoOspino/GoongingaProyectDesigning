import { NextResponse } from "next/server";
import { inflateRawSync } from "zlib";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_MAX_FILE_MB = 20;
const DEFAULT_GEMINI_TIMEOUT_MS = 55000;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

type GeminiResponsePayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
  };
};

function getOutputText(payload: GeminiResponsePayload) {
  return (
    payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text)
      .filter((text): text is string => Boolean(text))
      .join("\n") || ""
  );
}

function stripCodeFence(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);

  return (match?.[1] || trimmed).trim();
}

function normalizeModelName(model: string) {
  return model.trim().replace(/^models\//, "");
}

async function fetchGemini(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isPdf(file: File) {
  return file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf");
}

function isDocx(file: File) {
  return file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
}

function decodeXmlEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }

    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }

    const namedEntities: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    };

    return namedEntities[entity.toLowerCase()] || match;
  });
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 65557);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function getZipEntry(buffer: Buffer, targetName: string) {
  const eocdOffset = findEndOfCentralDirectory(buffer);

  if (eocdOffset < 0) {
    return null;
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42);
    const fileName = buffer.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength).toString("utf8");

    if (fileName === targetName) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        return compressed;
      }

      if (compressionMethod === 8) {
        return inflateRawSync(compressed);
      }

      throw new Error("El documento Word usa una compresion no soportada.");
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function xmlToText(xml: string) {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\s*\/>/g, "\t")
      .replace(/<w:(br|cr)[^>]*\/>/g, "\n")
      .replace(/<\/w:(p|tr)>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<[^>]+>/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function extractDocxText(buffer: Buffer) {
  const xmlPaths = [
    "word/document.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
    "word/comments.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/header3.xml",
    "word/footer1.xml",
    "word/footer2.xml",
    "word/footer3.xml",
  ];
  const parts = xmlPaths
    .map((path) => getZipEntry(buffer, path))
    .filter((entry): entry is Buffer => Boolean(entry))
    .map((entry) => xmlToText(entry.toString("utf8")))
    .filter(Boolean);
  const text = parts.join("\n\n").trim();

  if (!text) {
    throw new Error("No pude extraer texto del Word. Prueba exportarlo como PDF.");
  }

  return text;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = process.env.EXAMEN_GEMINI_PROMPT;
  const model = normalizeModelName(process.env.EXAMEN_GEMINI_MODEL || DEFAULT_MODEL);
  const maxFileMb = Number(process.env.EXAMEN_MAX_FILE_MB || DEFAULT_MAX_FILE_MB);
  const geminiTimeoutMs = Number(process.env.EXAMEN_GEMINI_TIMEOUT_MS || DEFAULT_GEMINI_TIMEOUT_MS);

  if (!apiKey) {
    return NextResponse.json({ error: "Falta GEMINI_API_KEY en el entorno de Vercel." }, { status: 500 });
  }

  if (!prompt) {
    return NextResponse.json({ error: "Falta EXAMEN_GEMINI_PROMPT en el entorno de Vercel." }, { status: 500 });
  }

  const formData = await request.formData();
  const uploadedDocument = formData.get("document");

  if (!(uploadedDocument instanceof File)) {
    return NextResponse.json({ error: "Sube un documento antes de ejecutar el prompt." }, { status: 400 });
  }

  if (uploadedDocument.size <= 0) {
    return NextResponse.json({ error: "El documento esta vacio." }, { status: 400 });
  }

  if (uploadedDocument.size > maxFileMb * 1024 * 1024) {
    return NextResponse.json({ error: `El documento supera el limite de ${maxFileMb} MB.` }, { status: 413 });
  }

  if (!isPdf(uploadedDocument) && !isDocx(uploadedDocument)) {
    return NextResponse.json({ error: "Formato no soportado. Usa PDF o Word .docx." }, { status: 415 });
  }

  const bytes = Buffer.from(await uploadedDocument.arrayBuffer());
  const encodedModel = encodeURIComponent(model);
  let parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;

  if (isDocx(uploadedDocument)) {
    let documentText = "";

    try {
      documentText = extractDocxText(bytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No pude extraer texto del Word.";

      return NextResponse.json({ error: message }, { status: 422 });
    }

    parts = [
      {
        text: `${prompt}\n\nDevuelve unicamente codigo HTML listo para renderizar. No uses Markdown, no uses fences de codigo y no agregues explicaciones fuera del HTML.\n\nContenido extraido del documento Word "${uploadedDocument.name}":\n\n${documentText}`,
      },
    ];
  } else {
    parts = [
      {
        text: `${prompt}\n\nDevuelve unicamente codigo HTML listo para renderizar. No uses Markdown, no uses fences de codigo y no agregues explicaciones fuera del HTML.`,
      },
      {
        inlineData: {
          mimeType: PDF_MIME,
          data: bytes.toString("base64"),
        },
      },
    ];
  }

  let geminiResponse: Response;

  try {
    geminiResponse = await fetchGemini(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts,
            },
          ],
        }),
      },
      geminiTimeoutMs
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ error: "Gemini tardo demasiado en responder. Prueba con un archivo mas pequeno o divide el examen." }, { status: 504 });
    }

    const message = error instanceof Error ? error.message : "No se pudo conectar con Gemini.";

    return NextResponse.json({ error: message }, { status: 502 });
  }

  const payload = (await geminiResponse.json().catch(() => null)) as GeminiResponsePayload | null;

  if (!geminiResponse.ok) {
    return NextResponse.json({ error: payload?.error?.message || "Gemini no pudo procesar el documento." }, { status: geminiResponse.status });
  }

  if (payload?.promptFeedback?.blockReason) {
    return NextResponse.json({ error: `Gemini bloqueo la solicitud: ${payload.promptFeedback.blockReason}.` }, { status: 422 });
  }

  const html = stripCodeFence(payload ? getOutputText(payload) : "");

  if (!html) {
    const finishReason = payload?.candidates?.[0]?.finishReason;
    const suffix = finishReason ? ` Finish reason: ${finishReason}.` : "";

    return NextResponse.json({ error: `Gemini respondio sin HTML renderizable.${suffix}` }, { status: 502 });
  }

  return NextResponse.json({ html });
}
