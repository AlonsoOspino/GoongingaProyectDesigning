const DEFAULT_ROLE_MENTION = "@unknown-role";

function formatDayOrdinal(day) {
  const n = Number(day);
  if (!Number.isFinite(n)) return String(day);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function formatEstAnnouncement(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
  }).format(date);
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
  }).format(date);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date).replace(/\s/g, "");

  return `${weekday} ${month} ${formatDayOrdinal(day)} @ ${time} EST`;
}

async function sendDiscordMatchScheduled({ teamAName, teamBName, startDate, teamALogo, teamBLogo, teamADiscordRoleId, teamBDiscordRoleId }) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  // Helper to format role mention from ID or use env fallback
  const getRoleMention = (roleId) => {
    if (roleId) {
      // Remove angle brackets and format if needed
      const cleanId = roleId.replace(/[<@&>]/g, "").trim();
      return cleanId ? `<@&${cleanId}>` : null;
    }
    return null;
  };

  const roleAMention = getRoleMention(teamADiscordRoleId);
  const roleBMention = getRoleMention(teamBDiscordRoleId);
  
  // Build mentions for both teams
  const mentions = [];
  if (roleAMention) mentions.push(roleAMention);
  if (roleBMention) mentions.push(roleBMention);
  
  // If no team mentions, use env mention
  if (mentions.length === 0) {
    mentions.push((process.env.DISCORD_ROLE_MENTION || DEFAULT_ROLE_MENTION).trim());
  }
  
  const mentionPrefix = mentions.length > 0 ? `${mentions.join(" ")} ` : "";
  const scheduleText = formatEstAnnouncement(startDate);
  const title = `${teamAName} vs ${teamBName}`;
  const content = `${mentionPrefix}Match scheduled`.trim();

  const payload = {
    content,
    embeds: [
      {
        title,
        description: `Going down ${scheduleText}`,
        color: 0x22d3ee,
        fields: [
          { name: "Team A", value: teamAName, inline: true },
          { name: "Team B", value: teamBName, inline: true },
          { name: "Time (EST)", value: scheduleText, inline: false },
        ],
        thumbnail: teamALogo ? { url: teamALogo } : undefined,
        image: teamBLogo ? { url: teamBLogo } : undefined,
        footer: { text: "Goonginga League" },
        timestamp: new Date(startDate).toISOString(),
      },
    ],
    allowed_mentions: {
      parse: ["roles", "users"],
    },
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Discord webhook failed (${response.status}): ${body}`);
  }
}

module.exports = {
  sendDiscordMatchScheduled,
};
