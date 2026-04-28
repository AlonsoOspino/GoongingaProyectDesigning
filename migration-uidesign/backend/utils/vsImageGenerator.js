const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");

async function generateVsImage({ teamALogo, teamBLogo, teamAName = "Team A", teamBName = "Team B" }) {
  const width = 1200;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Overwatch-themed gradient background (dark blue to dark purple)
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0a1428");
  gradient.addColorStop(0.5, "#1a0f2e");
  gradient.addColorStop(1, "#2d0a3d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add subtle grid pattern
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  for (let i = 0; i < height; i += 40) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(width, i);
    ctx.stroke();
  }

  const logoSize = 200;
  const logoY = (height - logoSize) / 2;

  // Load and draw Team A logo (left side)
  if (teamALogo) {
    try {
      const imageA = await loadImage(teamALogo);
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(imageA, 100, logoY, logoSize, logoSize);
      ctx.restore();
    } catch (err) {
      console.error("Failed to load Team A logo:", err.message);
      drawPlaceholderLogo(ctx, 100, logoY, logoSize, teamAName);
    }
  } else {
    drawPlaceholderLogo(ctx, 100, logoY, logoSize, teamAName);
  }

  // Load and draw Team B logo (right side)
  if (teamBLogo) {
    try {
      const imageB = await loadImage(teamBLogo);
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(imageB, width - 100 - logoSize, logoY, logoSize, logoSize);
      ctx.restore();
    } catch (err) {
      console.error("Failed to load Team B logo:", err.message);
      drawPlaceholderLogo(ctx, width - 100 - logoSize, logoY, logoSize, teamBName);
    }
  } else {
    drawPlaceholderLogo(ctx, width - 100 - logoSize, logoY, logoSize, teamBName);
  }

  // Draw glowing circles behind logos
  ctx.fillStyle = "rgba(88, 165, 238, 0.1)";
  ctx.beginPath();
  ctx.arc(100 + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 99, 71, 0.1)";
  ctx.beginPath();
  ctx.arc(width - 100 - logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 20, 0, Math.PI * 2);
  ctx.fill();

  // Draw "VS" in the center with glow effect
  const centerX = width / 2;
  const centerY = height / 2;

  // Glow effect
  ctx.fillStyle = "rgba(255, 215, 0, 0.2)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
  ctx.fill();

  // VS text with shadow
  ctx.font = "bold 120px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillText("VS", centerX + 3, centerY + 3);

  // Main text with gradient
  const textGradient = ctx.createLinearGradient(centerX - 60, centerY - 60, centerX + 60, centerY + 60);
  textGradient.addColorStop(0, "#FFD700");
  textGradient.addColorStop(0.5, "#FFA500");
  textGradient.addColorStop(1, "#FF6347");
  ctx.fillStyle = textGradient;
  ctx.fillText("VS", centerX, centerY);

  // Draw team names at the bottom
  ctx.font = "bold 32px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";

  // Team A name
  ctx.fillText(teamAName, 200, height - 40);

  // Team B name
  ctx.fillText(teamBName, width - 200, height - 40);

  // Dividing line in center
  ctx.strokeStyle = "rgba(255, 215, 0, 0.3)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Add watermark
  ctx.font = "12px Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.textAlign = "right";
  ctx.fillText("Goonginga League", width - 20, height - 10);

  return canvas.toBuffer("image/png");
}

function drawPlaceholderLogo(ctx, x, y, size, teamName) {
  ctx.fillStyle = "rgba(100, 100, 100, 0.3)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);

  ctx.font = "20px Arial";
  ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(teamName.substring(0, 1), x + size / 2, y + size / 2);
}

module.exports = {
  generateVsImage,
};
