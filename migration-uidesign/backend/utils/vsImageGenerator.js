const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");

async function generateVsImage({ teamALogo, teamBLogo, teamAName = "Team A", teamBName = "Team B" }) {
  const width = 1400;
  const height = 700;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const midX = width / 2;
  const midY = height / 2;

  await drawBackground(ctx, width, height);
  drawSidePanels(ctx, width, height);

  const logoDiameter = 250;
  const logoY = 190;
  const leftLogoX = 110;
  const rightLogoX = width - 110 - logoDiameter;

  await drawCircularLogo(ctx, {
    imageUrl: teamALogo,
    x: leftLogoX,
    y: logoY,
    diameter: logoDiameter,
    accent: "#4CC9F0",
    fallbackName: teamAName,
    fallbackGradient: ["#1d4ed8", "#0f172a"],
  });

  await drawCircularLogo(ctx, {
    imageUrl: teamBLogo,
    x: rightLogoX,
    y: logoY,
    diameter: logoDiameter,
    accent: "#FF6B6B",
    fallbackName: teamBName,
    fallbackGradient: ["#7f1d1d", "#0f172a"],
  });

  drawCenterBadge(ctx, midX, midY);
  drawTeamName(ctx, leftLogoX + logoDiameter / 2, 500, teamAName, "#9be7ff");
  drawTeamName(ctx, rightLogoX + logoDiameter / 2, 500, teamBName, "#ffb1b1");
  drawFooter(ctx, width, height);

  return canvas.toBuffer("image/png");
}

async function drawBackground(ctx, width, height) {
  const baseImagePath = path.join(__dirname, "..", "assets", "VSPARATEAM.jpg");
  let hasBaseImage = false;

  if (fs.existsSync(baseImagePath)) {
    try {
      const baseImage = await loadImage(baseImagePath);
      drawCoverImage(ctx, baseImage, 0, 0, width, height);
      hasBaseImage = true;
    } catch (err) {
      console.error("Failed to load base background image:", err.message);
    }
  } else {
    console.warn("Base background image not found:", baseImagePath);
  }

  const overlayAlpha = hasBaseImage ? 0.35 : 0.72;
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, `rgba(8, 17, 31, ${overlayAlpha})`);
  background.addColorStop(0.5, `rgba(16, 25, 43, ${overlayAlpha})`);
  background.addColorStop(1, `rgba(6, 11, 20, ${overlayAlpha})`);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, 720);
  glow.addColorStop(0, "rgba(84, 120, 255, 0.16)");
  glow.addColorStop(0.5, "rgba(35, 197, 255, 0.06)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(120, 170, 255, 0.18)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 56) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 56) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  ctx.fillRect(0, 78, width, 3);
  ctx.fillRect(0, height - 82, width, 3);
  ctx.restore();
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imageRatio > targetRatio) {
    drawHeight = height;
    drawWidth = height * imageRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / imageRatio;
    offsetY = (height - drawHeight) / 2;
  }

  ctx.drawImage(image, x + offsetX, y + offsetY, drawWidth, drawHeight);
}

function drawSidePanels(ctx, width, height) {
  const leftPanel = ctx.createLinearGradient(0, 0, width * 0.45, 0);
  leftPanel.addColorStop(0, "rgba(30, 70, 160, 0.35)");
  leftPanel.addColorStop(1, "rgba(30, 70, 160, 0)");

  const rightPanel = ctx.createLinearGradient(width, 0, width * 0.55, 0);
  rightPanel.addColorStop(0, "rgba(175, 40, 40, 0.35)");
  rightPanel.addColorStop(1, "rgba(175, 40, 40, 0)");

  ctx.fillStyle = leftPanel;
  ctx.fillRect(0, 120, width * 0.42, 410);

  ctx.fillStyle = rightPanel;
  ctx.fillRect(width * 0.58, 120, width * 0.42, 410);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width / 2, 120);
  ctx.lineTo(width / 2, 560);
  ctx.stroke();
  ctx.restore();
}

async function drawCircularLogo(ctx, { imageUrl, x, y, diameter, accent, fallbackName, fallbackGradient }) {
  const cx = x + diameter / 2;
  const cy = y + diameter / 2;
  const radius = diameter / 2;

  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 26;
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const loadedImage = await loadLogoImage(imageUrl);
  if (loadedImage) {
    const scale = Math.max(diameter / loadedImage.width, diameter / loadedImage.height);
    const drawWidth = loadedImage.width * scale;
    const drawHeight = loadedImage.height * scale;
    const drawX = cx - drawWidth / 2;
    const drawY = cy - drawHeight / 2;
    ctx.drawImage(loadedImage, drawX, drawY, drawWidth, drawHeight);
  } else {
    const gradient = ctx.createLinearGradient(x, y, x + diameter, y + diameter);
    gradient.addColorStop(0, fallbackGradient[0]);
    gradient.addColorStop(1, fallbackGradient[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, diameter, diameter);

    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.78, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 88px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getInitials(fallbackName), cx, cy - 2);
  }

  ctx.restore();
}

function drawCenterBadge(ctx, x, y) {
  ctx.save();
  ctx.shadowColor = "rgba(255, 188, 66, 0.45)";
  ctx.shadowBlur = 22;

  const badgeGradient = ctx.createLinearGradient(x - 92, y - 92, x + 92, y + 92);
  badgeGradient.addColorStop(0, "#ffcf5c");
  badgeGradient.addColorStop(1, "#ff7a18");

  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.beginPath();
  ctx.arc(x, y, 104, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = badgeGradient;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(x, y, 82, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#0a0f18";
  ctx.beginPath();
  ctx.arc(x, y, 68, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.font = "bold 112px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.strokeText("VS", x + 3, y + 3);
  ctx.fillStyle = badgeGradient;
  ctx.fillText("VS", x, y);

  ctx.restore();
}

function drawTeamName(ctx, centerX, baselineY, teamName, accentColor) {
  ctx.save();
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = accentColor;
  ctx.fillText(teamName, centerX, baselineY + 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(teamName, centerX, baselineY - 2);
  ctx.restore();
}

function drawFooter(ctx, width, height) {
  ctx.save();
  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.textAlign = "right";
  ctx.fillText("Goonginga League", width - 28, height - 18);
  ctx.restore();
}

async function loadLogoImage(imageUrl) {
  if (!imageUrl) return null;

  try {
    return await loadImage(imageUrl);
  } catch (err) {
    console.error("Failed to load logo image:", err.message);
    return null;
  }
}

function getInitials(teamName) {
  const words = String(teamName || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

module.exports = {
  generateVsImage,
};
