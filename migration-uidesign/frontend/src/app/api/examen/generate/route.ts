import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_MODEL = "gemini-3.5-flash";
const DEFAULT_MAX_FILE_MB = 20;

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

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = process.env.EXAMEN_GEMINI_PROMPT;
  const model = normalizeModelName(process.env.EXAMEN_GEMINI_MODEL || DEFAULT_MODEL);
  const maxFileMb = Number(process.env.EXAMEN_MAX_FILE_MB || DEFAULT_MAX_FILE_MB);

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

  const bytes = Buffer.from(await uploadedDocument.arrayBuffer());
  const mimeType = uploadedDocument.type || "application/octet-stream";
  const encodedModel = encodeURIComponent(model);
  const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${prompt}\n\nDevuelve unicamente codigo HTML listo para renderizar. No uses Markdown, no uses fences de codigo y no agregues explicaciones fuera del HTML.`,
            },
            {
              inlineData: {
                mimeType,
                data: bytes.toString("base64"),
              },
            },
          ],
        },
      ],
    }),
  });

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
