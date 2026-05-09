const DEFAULT_ROLE_MENTION = "@unknown-role";
const SERVER_ICON = "https://m.media-amazon.com/images/I/416gr5R0fdL.jpg";

function unixTime(dateValue) {
  return Math.floor(new Date(dateValue).getTime() / 1000);
}

function roleMention(roleId) {
  if (!roleId || roleId === "" || roleId === null || roleId === undefined) return null;

  const clean = String(roleId).replace(/[<@&>]/g, "").trim();
  if (!/^\d+$/.test(clean)) return null;

  return `<@&${clean}>`;
}

function buildMentions(teamARoleId, teamBRoleId) {
  const mentions = [];
  const mentionA = roleMention(teamARoleId) || DEFAULT_ROLE_MENTION;
  const mentionB = roleMention(teamBRoleId) || DEFAULT_ROLE_MENTION;

  mentions.push(mentionA);
  if (mentionB !== mentionA) mentions.push(mentionB);

  return mentions.join(" ");
}

function buildEmbed({ teamAName, teamBName, startDate, matchBannerUrl, isReschedule = false }) {
  const unix = unixTime(startDate);

  return {
    color: isReschedule ? 0xf59e0b : 0x5865f2,
    author: {
      name: isReschedule
        ? "GOONGINGA LEAGUE - MATCH UPDATED"
        : "GOONGINGA LEAGUE - MATCH LOCKED IN",
      icon_url: SERVER_ICON,
    },
    title: `${teamAName} vs ${teamBName}`,
    description: isReschedule
      ? `**Schedule Update**\n\n**New Time**\n<t:${unix}:F>\n\n**Starts**\n<t:${unix}:R>\n\nCaptains agreed to a new battle time.`
      : `**A new series has been scheduled**\n\n**Start**\n<t:${unix}:F>\n\n**Countdown**\n<t:${unix}:R>\n\nDrafts await.`,
    fields: [
      { name: "Team One", value: `**${teamAName}**`, inline: true },
      { name: "Series", value: "Best of 5", inline: true },
      { name: "Team Two", value: `**${teamBName}**`, inline: true },
    ],
    image: matchBannerUrl ? { url: matchBannerUrl } : undefined,
    footer: { text: "Goonginga League" },
    timestamp: new Date().toISOString(),
  };
}

function buildVsImageUrl({ appUrl, teamAId, teamBId, startDate }) {
  const cacheKey = startDate ? new Date(startDate).getTime() : Date.now();
  return `${appUrl}/match/${teamAId}/${teamBId}/vs-image?v=${cacheKey}`;
}

async function sendDiscordMatchScheduled({
  teamAName,
  teamBName,
  teamAId,
  teamBId,
  startDate,
  teamADiscordRoleId,
  teamBDiscordRoleId,
  matchBannerUrl,
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const appUrl = process.env.APP_URL || "https://goongingaproyectdesigning.onrender.com";
  if (!webhookUrl) return null;

  const mentions = buildMentions(teamADiscordRoleId, teamBDiscordRoleId);
  const vsImageUrl = buildVsImageUrl({ appUrl, teamAId, teamBId, startDate });

  const payload = {
    content: mentions
      ? `${mentions} Your match has been scheduled`
      : "Your match has been scheduled",
    embeds: [
      buildEmbed({
        teamAName,
        teamBName,
        startDate,
        matchBannerUrl: matchBannerUrl || vsImageUrl,
      }),
    ],
    allowed_mentions: {
      parse: ["roles", "users"],
    },
  };

  const response = await fetch(`${webhookUrl}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.id;
}

async function editDiscordMatchScheduled({
  messageId,
  teamAName,
  teamBName,
  teamAId,
  teamBId,
  startDate,
  teamADiscordRoleId,
  teamBDiscordRoleId,
  matchBannerUrl,
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const appUrl = process.env.APP_URL || "https://goongingaproyectdesigning.onrender.com";

  if (!webhookUrl || !messageId) return null;

  const mentions = buildMentions(teamADiscordRoleId, teamBDiscordRoleId);
  const vsImageUrl = buildVsImageUrl({ appUrl, teamAId, teamBId, startDate });

  const payload = {
    content: mentions
      ? `${mentions} Your match has been rescheduled`
      : "Your match has been rescheduled",
    embeds: [
      buildEmbed({
        teamAName,
        teamBName,
        startDate,
        matchBannerUrl: matchBannerUrl || vsImageUrl,
        isReschedule: true,
      }),
    ],
    allowed_mentions: {
      parse: ["roles", "users"],
    },
  };

  const response = await fetch(`${webhookUrl}/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Discord edit failed (${response.status}): ${body}`);
  }

  return messageId;
}

module.exports = {
  sendDiscordMatchScheduled,
  editDiscordMatchScheduled,
};
