const vision = require("@google-cloud/vision");

let client = null;

const getClient = () => {
  if (client) return client;
  client = new vision.ImageAnnotatorClient();
  return client;
};

const extractTextFromBuffer = async (buffer) => {
  if (!buffer || !buffer.length) {
    throw new Error("Image buffer is required.");
  }

  const visionClient = getClient();
  const [result] = await visionClient.textDetection({ image: { content: buffer } });
  const detections = result?.textAnnotations || [];

  if (!detections.length || !detections[0]?.description) {
    throw new Error("No text detected in image.");
  }

  return detections[0].description;
};

module.exports = {
  extractTextFromBuffer,
};
