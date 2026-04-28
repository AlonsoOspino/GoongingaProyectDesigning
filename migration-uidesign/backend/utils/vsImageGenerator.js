const { createCanvas, loadImage } = require("canvas");
const fetch = require("node-fetch");

async function generateVsImage({ teamALogo, teamBLogo, teamAName = "Team A", teamBName = "Team B" }) {
  const width = 1400;
  const height = 700;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Premium Overwatch-themed background with radial gradient
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Base gradient
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, "#0d0221");
  bgGradient.addColorStop(0.3, "#1a0326");
  bgGradient.addColorStop(0.7, "#1a0326");
  bgGradient.addColorStop(1, "#0d0221");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // Radial glow from center
  const radialGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.sqrt(width*width + height*height));
  radialGrad.addColorStop(0, "rgba(255, 215, 0, 0.08)");
  radialGrad.addColorStop(0.5, "rgba(255, 100, 0, 0.04)");
  radialGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = radialGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle animated-looking lines
  ctx.strokeStyle = "rgba(255, 215, 0, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  for (let i = 0; i < height; i += 50) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(width, i);
    ctx.stroke();
  }

  // Horizontal accent lines
  ctx.strokeStyle = "rgba(255, 150, 0, 0.1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.35);
  ctx.lineTo(width, height * 0.35);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(0, height * 0.65);
  ctx.lineTo(width, height * 0.65);
  ctx.stroke();

  const logoSize = 280;
  const logoY = (height - logoSize) / 2;
  const logoXLeft = 80;
  const logoXRight = width - 80 - logoSize;

  // Draw enhanced glow and shadow for Team A
  ctx.shadowColor = \"rgba(100, 200, 255, 0.6)\";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Team A glow circle
  ctx.fillStyle = \"rgba(100, 200, 255, 0.15)\";
  ctx.beginPath();
  ctx.arc(logoXLeft + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 30, 0, Math.PI * 2);
  ctx.fill();

  // Team A border glow
  ctx.strokeStyle = \"rgba(100, 200, 255, 0.3)\";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(logoXLeft + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 15, 0, Math.PI * 2);
  ctx.stroke();

  // Load and draw Team A logo (left side)
  if (teamALogo) {
    try {
      const imageA = await loadImage(teamALogo);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(imageA, logoXLeft, logoY, logoSize, logoSize);
      ctx.restore();
    } catch (err) {
      console.error(\"Failed to load Team A logo:\", err.message);
      drawPlaceholderLogo(ctx, logoXLeft, logoY, logoSize, teamAName);
    }
  } else {
    drawPlaceholderLogo(ctx, logoXLeft, logoY, logoSize, teamAName);
  }

  // Reset shadow
  ctx.shadowColor = \"transparent\";
  ctx.shadowBlur = 0;

  // Draw enhanced glow and shadow for Team B
  ctx.shadowColor = \"rgba(255, 100, 100, 0.6)\";
  ctx.shadowBlur = 40;

  // Team B glow circle
  ctx.fillStyle = \"rgba(255, 100, 100, 0.15)\";
  ctx.beginPath();
  ctx.arc(logoXRight + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 30, 0, Math.PI * 2);
  ctx.fill();

  // Team B border glow
  ctx.strokeStyle = \"rgba(255, 100, 100, 0.3)\";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(logoXRight + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 15, 0, Math.PI * 2);
  ctx.stroke();

  // Load and draw Team B logo (right side)
  if (teamBLogo) {
    try {
      const imageB = await loadImage(teamBLogo);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.drawImage(imageB, logoXRight, logoY, logoSize, logoSize);
      ctx.restore();
    } catch (err) {
      console.error(\"Failed to load Team B logo:\", err.message);
      drawPlaceholderLogo(ctx, logoXRight, logoY, logoSize, teamBName);
    }
  } else {
    drawPlaceholderLogo(ctx, logoXRight, logoY, logoSize, teamBName);
  }

  // Reset shadow
  ctx.shadowColor = \"transparent\";
  ctx.shadowBlur = 0;

  // Draw "VS" in the center with dramatic glow effect
  const centerX = width / 2;
  const centerY = height / 2;

  // Large outer glow
  ctx.shadowColor = \"rgba(255, 215, 0, 0.8)\";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Glow circles
  ctx.fillStyle = \"rgba(255, 215, 0, 0.25)\";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = \"rgba(255, 215, 0, 0.15)\";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 160, 0, Math.PI * 2);
  ctx.fill();

  // VS text with dramatic effect
  ctx.font = \"bold 200px 'Arial Black', sans-serif\";
  ctx.textAlign = \"center\";
  ctx.textBaseline = \"middle\";

  // Triple shadow for depth
  ctx.fillStyle = \"rgba(0, 0, 0, 0.8)\";
  ctx.fillText(\"VS\", centerX + 5, centerY + 5);
  
  ctx.fillStyle = \"rgba(0, 0, 0, 0.4)\";
  ctx.fillText(\"VS\", centerX + 2, centerY + 2);

  // Main text with vibrant gradient
  const textGradient = ctx.createLinearGradient(centerX - 100, centerY - 100, centerX + 100, centerY + 100);
  textGradient.addColorStop(0, \"#FFD700\");
  textGradient.addColorStop(0.3, \"#FFA500\");
  textGradient.addColorStop(0.7, \"#FF6347\");
  textGradient.addColorStop(1, \"#FF4500\");
  ctx.fillStyle = textGradient;
  ctx.fillText(\"VS\", centerX, centerY);

  // Outer stroke for more definition
  ctx.strokeStyle = \"rgba(255, 215, 0, 0.5)\";
  ctx.lineWidth = 4;
  ctx.strokeText(\"VS\", centerX, centerY);

  ctx.shadowColor = \"transparent\";
  ctx.shadowBlur = 0;

  // Draw team names at the bottom with better styling
  ctx.font = \"bold 40px 'Arial Black', sans-serif\";
  ctx.textAlign = \"center\";
  
  // Team A name with blue shadow
  ctx.fillStyle = \"rgba(100, 200, 255, 0.3)\";
  ctx.fillText(teamAName, 200 + 2, height - 35);
  ctx.fillStyle = \"#FFFFFF\";
  ctx.fillText(teamAName, 200, height - 40);

  // Team B name with red shadow
  ctx.fillStyle = \"rgba(255, 100, 100, 0.3)\";
  ctx.fillText(teamBName, width - 200 + 2, height - 35);
  ctx.fillStyle = \"#FFFFFF\";
  ctx.fillText(teamBName, width - 200, height - 40);

  // Vertical dividing line with glow
  ctx.strokeStyle = \"rgba(255, 215, 0, 0.5)\";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(centerX, 80);
  ctx.lineTo(centerX, height - 80);
  ctx.stroke();

  // Dashed line on top for visual interest
  ctx.strokeStyle = \"rgba(255, 150, 0, 0.3)\";
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, 80);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX, height - 80);
  ctx.lineTo(centerX, height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Add watermark
  ctx.font = \"14px Arial\";
  ctx.fillStyle = \"rgba(255, 215, 0, 0.4)\";
  ctx.textAlign = \"right\";
  ctx.fillText(\"Goonginga League\", width - 30, height - 20);

  return canvas.toBuffer(\"image/png\");
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
