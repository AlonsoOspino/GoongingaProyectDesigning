const vision = require("@google-cloud/vision");

let client = null;

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
          features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
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

const extractOcrFromBuffer = async (buffer) => {
  if (!buffer || !buffer.length) {
    throw new Error("Image buffer is required.");
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  let result;
  try {
    if (apiKey) {
      result = await extractFromApiKey(buffer, apiKey);
    } else {
      const visionClient = getClient();
      [result] = await visionClient.textDetection({ image: { content: buffer } });
    }
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

  const annotations = Array.isArray(result?.textAnnotations) ? result.textAnnotations : [];
  const text = annotations[0]?.description || "";
  if (!text.trim()) {
    throw new Error("No text detected in image.");
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

const extractTextFromBuffer = async (buffer) => {
  const { text } = await extractOcrFromBuffer(buffer);
  return text;
};

module.exports = {
  extractTextFromBuffer,
  extractOcrFromBuffer,
};
