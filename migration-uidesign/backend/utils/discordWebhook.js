const DEFAULT_ROLE_MENTION = "@unknown-role";

function getUnixTimestamp(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function getRoleMention(roleId) {
  if (!roleId) return null;

  const cleanId = String(roleId)
    .replace(/[<@&>]/g, "")
    .trim();

  return cleanId ? `<@&${cleanId}>` : null;
}

function buildMentions(teamADiscordRoleId, teamBDiscordRoleId) {
  const mentions = [];

  const a = getRoleMention(teamADiscordRoleId);
  const b = getRoleMention(teamBDiscordRoleId);

  if (a) mentions.push(a);
  if (b && b !== a) mentions.push(b);

  if (!mentions.length) {
    const fallback = (
      process.env.DISCORD_ROLE_MENTION ||
      DEFAULT_ROLE_MENTION
    ).trim();

    if (fallback) mentions.push(fallback);
  }

  return mentions.join(" ");
}

function buildEmbed({
  teamAName,
  teamBName,
  startDate,
  teamALogo,
  isReschedule = false,
}) {
  const unix = getUnixTimestamp(startDate);

  return {
    color: isReschedule
      ? 0xF59E0B // amber
      : 0x5865F2, // discord blurple

    author: {
      name: isReschedule
        ? "GOONGINGA LEAGUE • MATCH UPDATED"
        : "GOONGINGA LEAGUE • MATCH LOCKED IN",
      icon_url: teamALogo || undefined,
    },

    title: isReschedule
      ? `📣 ${teamAName} vs ${teamBName}`
      : `⚔ ${teamAName} vs ${teamBName}`,

    description: isReschedule
      ? `**Schedule Update**

🗓 **New Time:** <t:${unix}:F>
⏳ **Starts:** <t:${unix}:R>

Captains have agreed to a new battle time.`
      : `**A new series has been scheduled**

🗓 **Start:** <t:${unix}:F>
⏳ **Countdown:** <t:${unix}:R>

Prepare drafts. Prepare for war.`,

    fields: [
      {
        name: "🔵 Team One",
        value: `**${teamAName}**`,
        inline: true,
      },
      {
        name: "🔴 Team Two",
        value: `**${teamBName}**`,
        inline: true,
      },
      {
        name: "🎯 Status",
        value: isReschedule
          ? "Rescheduled"
          : "Scheduled",
        inline: true,
      },
    ],

    thumbnail: teamALogo
      ? { url: teamALogo }
      : undefined,

    footer: {
      text: "Goonginga League • Draft battles await",
    },

    timestamp: new Date().toISOString(),
  };
}

async function sendDiscordMatchScheduled({
  teamAName,
  teamBName,
  startDate,
  teamALogo,
  teamADiscordRoleId,
  teamBDiscordRoleId,
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return null;

  const mentions = buildMentions(
    teamADiscordRoleId,
    teamBDiscordRoleId
  );

  const payload = {
    content:
      `${mentions} ⚔ Your match has been scheduled.`.trim(),

    embeds: [
      buildEmbed({
        teamAName,
        teamBName,
        startDate,
        teamALogo,
      }),
    ],

    allowed_mentions: {
      parse: ["roles", "users"],
    },
  };

  // ?wait=true required to get message object back
  const response = await fetch(
    `${webhookUrl}?wait=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Discord webhook failed (${response.status}): ${body}`
    );
  }

  const data = await response.json();

  return data.id;
}

async function editDiscordMatchScheduled({
  messageId,
  teamAName,
  teamBName,
  startDate,
  teamALogo,
  teamADiscordRoleId,
  teamBDiscordRoleId,
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl || !messageId) {
    return null;
  }

  const mentions = buildMentions(
    teamADiscordRoleId,
    teamBDiscordRoleId
  );

  const payload = {
    content:
      `${mentions} 📣 Your match has been rescheduled.`.trim(),

    embeds: [
      buildEmbed({
        teamAName,
        teamBName,
        startDate,
        teamALogo,
        isReschedule: true,
      }),
    ],

    allowed_mentions: {
      parse: ["roles", "users"],
    },
  };

  const response = await fetch(
    `${webhookUrl}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Discord edit failed (${response.status}): ${body}`
    );
  }

  return messageId;
}

module.exports = {
  sendDiscordMatchScheduled,
  editDiscordMatchScheduled,
};