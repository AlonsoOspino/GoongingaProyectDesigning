const DEFAULT_ROLE_MENTION = "@unknown-role";

const SERVER_ICON =
"https://m.media-amazon.com/images/I/416gr5R0fdL.jpg";

function unixTime(dateValue) {
  return Math.floor(new Date(dateValue).getTime()/1000);
}

function roleMention(roleId) {
  if (!roleId || roleId === "" || roleId === null || roleId === undefined) return null;

  const clean = String(roleId).replace(/[<@&>]/g, "").trim();

  // Must be numeric
  if (!/^\d+$/.test(clean)) return null;

  return `<@&${clean}>`;
}

function buildMentions(a, b) {
  const mentions = [];

  // Team A: use role mention or default
  const mentionA = roleMention(a) || DEFAULT_ROLE_MENTION;
  mentions.push(mentionA);

  // Team B: use role mention or default (only add if different from Team A)
  const mentionB = roleMention(b) || DEFAULT_ROLE_MENTION;
  if (mentionB !== mentionA) {
    mentions.push(mentionB);
  }

  return mentions.join(" ");
}

function buildEmbed({
 teamAName,
 teamBName,
 startDate,
 matchBannerUrl,
 isReschedule=false
}) {

 const unix=unixTime(startDate);

 return {
   color: isReschedule
    ? 0xF59E0B
    : 0x5865F2,

   author:{
     name:isReschedule
       ? "GOONGINGA LEAGUE • MATCH UPDATED"
       : "GOONGINGA LEAGUE • MATCH LOCKED IN",
     icon_url: SERVER_ICON
   },

   title:`⚔ ${teamAName} vs ${teamBName}`,

   description:isReschedule
? `**Schedule Update**

🗓 **New Time**
<t:${unix}:F>

⏳ **Starts**
<t:${unix}:R>

Captains agreed to a new battle time.`
: `**A new series has been scheduled**

🗓 **Start**
<t:${unix}:F>

⏳ **Countdown**
<t:${unix}:R>

Drafts await.`,

fields:[
{
name:"🔵 Team One",
value:`**${teamAName}**`,
inline:true
},
{
name:"⚔ Series",
value:"Best of 5",
inline:true
},
{
name:"🔴 Team Two",
value:`**${teamBName}**`,
inline:true
}
],

image: matchBannerUrl
 ? { url: matchBannerUrl }
 : undefined,

footer:{
 text:"Goonginga League"
},

timestamp:new Date().toISOString()
 };
}

async function sendDiscordMatchScheduled({
  teamAName,
  teamBName,
  teamAId,
  teamBId,
  startDate,
  teamADiscordRoleId,
  teamBDiscordRoleId,
  matchBannerUrl
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const appUrl = process.env.APP_URL || "https://goongingaproyectdesigning.onrender.com";

  if (!webhookUrl) return null;

  const mentions = buildMentions(
    teamADiscordRoleId,
    teamBDiscordRoleId
  );

  // Generate VS image URL with cache-busting so Discord refreshes the image
  const cacheKey = startDate ? new Date(startDate).getTime() : Date.now();
  const vsImageUrl = `${appUrl}/match/${teamAId}/${teamBId}/vs-image?v=${cacheKey}`;

  const payload = {
    content: mentions
      ? `${mentions} ⚔ Your match has been scheduled`
      : "⚔ Your match has been scheduled",

    embeds: [
      buildEmbed({
        teamAName,
        teamBName,
        startDate,
        matchBannerUrl: vsImageUrl, // Use the generated VS image
      })
    ],

    allowed_mentions: {
      parse: ["roles", "users"]
    }
  };

  const response = await fetch(
    `${webhookUrl}?wait=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
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
  teamAId,
  teamBId,
  startDate,
  teamADiscordRoleId,
  teamBDiscordRoleId,
  matchBannerUrl
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const appUrl = process.env.APP_URL || "https://goongingaproyectdesigning.onrender.com";

  if (!webhookUrl || !messageId) {
    return null;
  }

  const mentions = buildMentions(
    teamADiscordRoleId,
    teamBDiscordRoleId
  );

  // Generate VS image URL with cache-busting so Discord refreshes the image
  const cacheKey = startDate ? new Date(startDate).getTime() : Date.now();
  const vsImageUrl = `${appUrl}/match/${teamAId}/${teamBId}/vs-image?v=${cacheKey}`;

  const payload = {
    content: mentions
      ? `${mentions} 📣 Your match has been rescheduled`
      : "📣 Your match has been rescheduled",

    embeds: [
      buildEmbed({
        teamAName,
        teamBName,
        startDate,
        matchBannerUrl: vsImageUrl, // Use the generated VS image
        isReschedule: true
      })
    ],

    allowed_mentions: {
      parse: ["roles", "users"]
    }
  };

  const response = await fetch(
    `${webhookUrl}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
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

module.exports={
sendDiscordMatchScheduled,
editDiscordMatchScheduled
};