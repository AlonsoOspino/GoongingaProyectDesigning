const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const networkMemberRepo = require("../repositories/networkMember");

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const STATE_COOKIE_NAME = "goonginga_network_oauth_state";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function getRequiredConfig() {
  const config = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    guildId: process.env.DISCORD_GUILD_ID,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
    frontendUrl: process.env.NETWORK_FRONTEND_URL,
    jwtSecret: process.env.NETWORK_JWT_SECRET,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing Discord network configuration: ${missing.join(", ")}`);
  }

  return config;
}

function readCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .reduce((cookies, rawCookie) => {
      const separator = rawCookie.indexOf("=");
      if (separator < 0) return cookies;

      const key = rawCookie.slice(0, separator).trim();
      const value = rawCookie.slice(separator + 1).trim();
      if (key) cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function clearStateCookie(res) {
  res.clearCookie(STATE_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/network-auth/discord",
  });
}

function loginPageUrl(frontendUrl, params = {}) {
  const url = new URL("/login", frontendUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function redirectWithError(res, frontendUrl, message) {
  return res.redirect(loginPageUrl(frontendUrl, { discord_error: message }));
}

function toDiscordAvatarUrl(discordUser) {
  if (discordUser.avatar) {
    return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256`;
  }

  const defaultAvatarIndex = Number(BigInt(discordUser.id) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
}

function toJoinedAt(member) {
  if (!member?.joined_at) return new Date();
  const joinedAt = new Date(member.joined_at);
  return Number.isNaN(joinedAt.getTime()) ? new Date() : joinedAt;
}

async function discordRequest(path, accessToken, options = {}) {
  const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error(`Discord API request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function exchangeAuthorizationCode(code, config) {
  const requestBody = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(`${DISCORD_API_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: requestBody,
  });

  if (!response.ok) {
    throw new Error(`Discord token exchange failed with status ${response.status}`);
  }

  const token = await response.json();
  if (!token?.access_token) throw new Error("Discord did not return an access token.");
  return token.access_token;
}

async function startDiscordAuth(req, res) {
  try {
    const config = getRequiredConfig();
    const state = crypto.randomBytes(32).toString("hex");

    res.cookie(STATE_COOKIE_NAME, state, {
      httpOnly: true,
      maxAge: OAUTH_STATE_TTL_MS,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/network-auth/discord",
    });

    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
    authorizeUrl.searchParams.set("scope", "identify guilds.members.read");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("prompt", "consent");

    return res.redirect(authorizeUrl.toString());
  } catch (error) {
    return res.status(503).json({ message: error.message });
  }
}

async function finishDiscordAuth(req, res) {
  let config;
  try {
    config = getRequiredConfig();
  } catch (error) {
    return res.status(503).json({ message: error.message });
  }

  if (req.query.error) {
    clearStateCookie(res);
    return redirectWithError(res, config.frontendUrl, "Discord authorization was cancelled.");
  }

  const providedState = typeof req.query.state === "string" ? req.query.state : "";
  const expectedState = readCookies(req)[STATE_COOKIE_NAME] || "";
  clearStateCookie(res);

  if (
    !providedState ||
    !expectedState ||
    providedState.length !== expectedState.length ||
    !crypto.timingSafeEqual(Buffer.from(providedState), Buffer.from(expectedState))
  ) {
    return redirectWithError(res, config.frontendUrl, "Your Discord login expired. Please try again.");
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) {
    return redirectWithError(res, config.frontendUrl, "Discord did not return an authorization code.");
  }

  try {
    const accessToken = await exchangeAuthorizationCode(code, config);
    const discordUser = await discordRequest("/users/@me", accessToken);
    const guildMember = await discordRequest(
      `/users/@me/guilds/${encodeURIComponent(config.guildId)}/member`,
      accessToken,
    );

    if (guildMember?.pending) {
      return redirectWithError(
        res,
        config.frontendUrl,
        "Complete Discord's membership screening for GGL, then try again.",
      );
    }

    const member = await networkMemberRepo.upsertFromDiscord({
      discordUserId: discordUser.id,
      username: discordUser.global_name || discordUser.username,
      avatarUrl: toDiscordAvatarUrl(discordUser),
      joinedAt: toJoinedAt(guildMember),
    });

    const token = jwt.sign(
      {
        id: member.id,
        accountType: "NETWORK_MEMBER",
        username: member.username,
        avatarUrl: member.avatarUrl,
        roles: member.roles,
      },
      config.jwtSecret,
      { expiresIn: "7d" },
    );

    // A fragment is never sent to the frontend server or its logs. The login
    // page saves this token locally and immediately removes it from the URL.
    const callbackUrl = new URL("/login", config.frontendUrl);
    callbackUrl.hash = new URLSearchParams({ network_token: token }).toString();
    return res.redirect(callbackUrl.toString());
  } catch (error) {
    if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
      return redirectWithError(res, config.frontendUrl, "Join the GGL Discord server before registering.");
    }

    console.error("[network-auth] Discord login failed:", error?.message || error);
    return redirectWithError(res, config.frontendUrl, "We could not finish your Discord login. Please try again.");
  }
}

module.exports = {
  startDiscordAuth,
  finishDiscordAuth,
  __testables: {
    readCookies,
    toDiscordAvatarUrl,
    toJoinedAt,
  },
};
