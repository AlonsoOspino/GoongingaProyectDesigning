const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const baseUrl = "http://127.0.0.1:3100/announcements";

function tokenFor(id) {
  const secret = process.env.NETWORK_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("Network JWT secret is not configured.");
  return jwt.sign({ id, accountType: "NETWORK_MEMBER" }, secret, { expiresIn: "15m" });
}

async function request(label, path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  console.log(`\n${label}\nHTTP ${response.status}\n${JSON.stringify(payload, null, 2)}`);
  return { status: response.status, payload };
}

async function main() {
  if (!String(process.env.DATABASE_URL).includes("goonginga_dev")) {
    throw new Error("Refusing to run outside goonginga_dev.");
  }

  const managerToken = tokenFor(1);
  const memberToken = tokenFor(15);
  const originalAnnouncements = await prisma.announcement.findMany({
    select: { id: true, published: true, order: true },
  });
  const originalMode = await prisma.announcementMode.findUnique({ where: { id: 1 } });
  const latestMatch = await prisma.match.findFirst({
    where: { status: "FINISHED", startDate: { not: null } },
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    select: { id: true, startDate: true },
  });
  const createdIds = [];

  try {
    await prisma.announcement.updateMany({ data: { published: false } });
    await prisma.announcementMode.upsert({
      where: { id: 1 },
      create: { id: 1, enabled: true },
      update: { enabled: true },
    });

    await request("ACTIVE: zero published", "/active");

    const first = await request("ROUND TRIP: POST custom", "", {
      token: managerToken,
      method: "POST",
      body: {
        name: "Verification custom",
        type: "CUSTOM",
        content: { headline: "First verification" },
        published: true,
      },
    });
    createdIds.push(first.payload.id);
    await request("ACTIVE: one published", "/active");

    const second = await request("POST form fixture", "", {
      token: managerToken,
      method: "POST",
      body: {
        name: "Verification form",
        type: "FORM",
        content: { headline: "Registration", formUrl: "/forms/verification" },
        published: true,
      },
    });
    createdIds.push(second.payload.id);
    const third = await request("POST third fixture", "", {
      token: managerToken,
      method: "POST",
      body: {
        name: "Verification third",
        type: "CUSTOM",
        content: { headline: "Third verification" },
        published: true,
      },
    });
    createdIds.push(third.payload.id);

    await request("ROUND TRIP: PATCH custom", `/${first.payload.id}`, {
      token: managerToken,
      method: "PATCH",
      body: { name: "Verification custom edited", content: { headline: "Edited verification" } },
    });
    await request("ROUND TRIP: PATCH reorder", "/reorder", {
      token: managerToken,
      method: "PATCH",
      body: { ids: [third.payload.id, first.payload.id, second.payload.id] },
    });
    await request("ACTIVE: three published, ascending order", "/active");

    await request("INVALID: unsafe custom link", `/${first.payload.id}`, {
      token: managerToken,
      method: "PATCH",
      body: { content: { headline: "Unsafe", ctaHref: "/\\evil.host" } },
    });
    await request("INVALID: unsafe form link", `/${second.payload.id}`, {
      token: managerToken,
      method: "PATCH",
      body: { content: { headline: "Unsafe", formUrl: "/\\evil.host" } },
    });
    await request("INVALID: unknown JEOPARDY type", "", {
      token: managerToken,
      method: "POST",
      body: { name: "Unknown", type: "JEOPARDY", content: {} },
    });

    await request("AUTH: list without token", "");
    await request("AUTH: list as plain member", "", { token: memberToken });
    await request("AUTH: settings as plain member", "/settings", {
      token: memberToken,
      method: "PATCH",
      body: { enabled: false },
    });

    await request("DISABLED: manager turns section off", "/settings", {
      token: managerToken,
      method: "PATCH",
      body: { enabled: false },
    });
    await request("DISABLED: published content does not leak", "/active");
    await request("REENABLE", "/settings", {
      token: managerToken,
      method: "PATCH",
      body: { enabled: true },
    });

    await prisma.announcement.updateMany({ data: { published: false } });
    if (!latestMatch) throw new Error("No dated finished match is available for null-date verification.");
    await prisma.match.update({ where: { id: latestMatch.id }, data: { startDate: null } });
    const tournament = await request("POST tournament fixture", "", {
      token: managerToken,
      method: "POST",
      body: {
        name: "Verification tournament",
        type: "TOURNAMENT",
        content: {},
        published: true,
      },
    });
    createdIds.push(tournament.payload.id);
    await request(`NULL DATE: match ${latestMatch.id} must not win fallback`, "/active");
    await prisma.match.update({ where: { id: latestMatch.id }, data: { startDate: latestMatch.startDate } });

    await request("ROUND TRIP: DELETE custom", `/${first.payload.id}`, {
      token: managerToken,
      method: "DELETE",
    });
    createdIds.splice(createdIds.indexOf(first.payload.id), 1);
  } finally {
    if (latestMatch) {
      await prisma.match.update({ where: { id: latestMatch.id }, data: { startDate: latestMatch.startDate } });
    }
    if (createdIds.length) {
      await prisma.announcement.deleteMany({ where: { id: { in: createdIds } } });
    }
    for (const announcement of originalAnnouncements) {
      await prisma.announcement.update({
        where: { id: announcement.id },
        data: { published: announcement.published, order: announcement.order },
      });
    }
    if (originalMode) {
      await prisma.announcementMode.update({
        where: { id: originalMode.id },
        data: { enabled: originalMode.enabled, updatedById: originalMode.updatedById },
      });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
