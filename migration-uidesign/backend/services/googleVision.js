const vision = require("@google-cloud/vision");
const sharp = require("sharp");

let client = null;

const OCR_REGION_LAYOUT = Object.freeze({
  // Central scoreboard area (blue + red tables).
  scoreboard: { left: 0.24, top: 0.14, width: 0.54, height: 0.79 },
  // Top-right area where map + TIME are displayed.
  timer: { left: 0.79, top: 0.0, width: 0.21, height: 0.14 },
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const extractFromApiKey = async (buffer, apiKey) => {
  const content = Buffer.from(buffer).toString("base64");
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        },
      ],
    }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch (_err) {
    throw new Error("Google Vision API key request failed: invalid JSON response.");
  }

  if (!response.ok) {
    const apiMessage = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Google Vision API key request failed: ${apiMessage}`);
  }

  const result = payload?.responses?.[0] || {};
  if (result?.error?.message) {
    throw new Error(`Google Vision API key request failed: ${result.error.message}`);
  }

  return result;
};

const getClient = () => {
  if (client) return client;

  const projectId = process.env.GOOGLE_VISION_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_VISION_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_VISION_PRIVATE_KEY;
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (projectId && clientEmail && privateKey) {
    client = new vision.ImageAnnotatorClient({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, "\n"),
      },
    });
    return client;
  }

  if (!adcPath) {
    throw new Error(
      "Google Vision credentials missing. Set GOOGLE_APPLICATION_CREDENTIALS to a service account key path, or set GOOGLE_VISION_PROJECT_ID, GOOGLE_VISION_CLIENT_EMAIL, and GOOGLE_VISION_PRIVATE_KEY."
    );
  }

  client = new vision.ImageAnnotatorClient();
  return client;
};

const runVisionOcr = async (buffer) => {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (apiKey) {
    return extractFromApiKey(buffer, apiKey);
  }

  const visionClient = getClient();
  const [result] = await visionClient.documentTextDetection({ image: { content: buffer } });
  return result;
};

const flattenWords = (annotationResult) => {
  const pages = annotationResult?.fullTextAnnotation?.pages;
  if (!Array.isArray(pages)) return [];

  const words = [];
  for (const page of pages) {
    for (const block of page.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const word of paragraph.words || []) {
          const description = (word.symbols || []).map((symbol) => String(symbol?.text || "")).join("");
          const vertices = Array.isArray(word?.boundingBox?.vertices) ? word.boundingBox.vertices : [];
          const xs = vertices.map((v) => Number(v?.x || 0));
          const ys = vertices.map((v) => Number(v?.y || 0));
          words.push({
            text: description,
            confidence: Number(word?.confidence || 0),
            bbox: {
              x0: xs.length ? Math.min(...xs) : 0,
              y0: ys.length ? Math.min(...ys) : 0,
              x1: xs.length ? Math.max(...xs) : 0,
              y1: ys.length ? Math.max(...ys) : 0,
            },
          });
        }
      }
    }
  }
  return words;
};

const normalizeOcrResult = (result) => {
  let annotations = Array.isArray(result?.textAnnotations) ? result.textAnnotations : [];
  let text = annotations[0]?.description || result?.fullTextAnnotation?.text || "";

  const documentWords = flattenWords(result);
  if (documentWords.length) {
    annotations = [{ description: text }, ...documentWords.map((word) => ({
      description: word.text,
      confidence: word.confidence,
      boundingPoly: {
        vertices: [
          { x: word.bbox.x0, y: word.bbox.y0 },
          { x: word.bbox.x1, y: word.bbox.y0 },
          { x: word.bbox.x1, y: word.bbox.y1 },
          { x: word.bbox.x0, y: word.bbox.y1 },
        ],
      },
    }))];
  }

  const words = annotations
    .slice(1)
    .map((a) => {
      const vertices = Array.isArray(a?.boundingPoly?.vertices) ? a.boundingPoly.vertices : [];
      const xs = vertices.map((v) => Number(v?.x || 0));
      const ys = vertices.map((v) => Number(v?.y || 0));
      const x0 = xs.length ? Math.min(...xs) : 0;
      const x1 = xs.length ? Math.max(...xs) : 0;
      const y0 = ys.length ? Math.min(...ys) : 0;
      const y1 = ys.length ? Math.max(...ys) : 0;

      return {
        text: String(a?.description || "").trim(),
        confidence: Number(a?.confidence || 0),
        bbox: { x0, y0, x1, y1 },
      };
    })
    .filter((w) => w.text.length > 0);

  return { text, words };
};

const extractFixedRegions = async (buffer) => {
  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  const imageWidth = Number(metadata?.width || 0);
  const imageHeight = Number(metadata?.height || 0);

  if (!imageWidth || !imageHeight) {
    throw new Error("Could not read image dimensions.");
  }

  const makeRect = (region) => {
    const left = clamp(Math.floor(imageWidth * region.left), 0, imageWidth - 1);
    const top = clamp(Math.floor(imageHeight * region.top), 0, imageHeight - 1);
    const width = clamp(Math.floor(imageWidth * region.width), 1, imageWidth - left);
    const height = clamp(Math.floor(imageHeight * region.height), 1, imageHeight - top);
    return { left, top, width, height };
  };

  const scoreboardRect = makeRect(OCR_REGION_LAYOUT.scoreboard);
  const timerRect = makeRect(OCR_REGION_LAYOUT.timer);

  const [scoreboardBuffer, timerBuffer] = await Promise.all([
    sharp(buffer, { failOn: "none" }).extract(scoreboardRect).png().toBuffer(),
    sharp(buffer, { failOn: "none" }).extract(timerRect).png().toBuffer(),
  ]);

  return { scoreboardBuffer, timerBuffer };
};

const extractOcrFromBuffer = async (buffer) => {
  if (!buffer || !buffer.length) {
    throw new Error("Image buffer is required.");
  }

  let scoreboardInputBuffer = buffer;
  let timerInputBuffer = null;
  try {
    const regions = await extractFixedRegions(buffer);
    scoreboardInputBuffer = regions.scoreboardBuffer;
    timerInputBuffer = regions.timerBuffer;
  } catch (err) {
    // If cropping fails for any reason, continue with full image OCR as fallback.
    scoreboardInputBuffer = buffer;
    timerInputBuffer = null;
  }

  let scoreboardResult;
  try {
    scoreboardResult = await runVisionOcr(scoreboardInputBuffer);
  } catch (err) {
    const message = String(err?.message || "");
    if (
      message.includes("Could not load the default credentials") ||
      message.includes("The Application Default Credentials are not available") ||
      message.includes("permission") ||
      message.includes("Unauthenticated")
    ) {
      throw new Error(
        "Google Vision credentials missing or invalid. Set GOOGLE_VISION_API_KEY, or provide GOOGLE_APPLICATION_CREDENTIALS path, or set GOOGLE_VISION_PROJECT_ID, GOOGLE_VISION_CLIENT_EMAIL, and GOOGLE_VISION_PRIVATE_KEY."
      );
    }
    throw new Error(`Google Vision OCR failed: ${message || "unknown error"}`);
  }

  const scoreboardOcr = normalizeOcrResult(scoreboardResult);

  let timerOcrText = "";
  if (timerInputBuffer) {
    try {
      const timerResult = await runVisionOcr(timerInputBuffer);
      timerOcrText = normalizeOcrResult(timerResult).text || "";
    } catch (_timerErr) {
      timerOcrText = "";
    }
  }

  const combinedText = [scoreboardOcr.text, timerOcrText]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join("\n");

  if (!combinedText.trim()) {
    throw new Error("No text detected in image.");
  }

  // For stats parsing we intentionally keep only scoreboard words.
  return { text: combinedText, words: scoreboardOcr.words };
};

const extractTextFromBuffer = async (buffer) => {
  const { text } = await extractOcrFromBuffer(buffer);
  return text;
};

module.exports = {
  extractTextFromBuffer,
  extractOcrFromBuffer,
};
