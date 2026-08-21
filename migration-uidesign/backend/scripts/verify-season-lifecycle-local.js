const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const API_BASE = process.env.VERIFICATION_API_BASE || "http://127.0.0.1:3100";

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function main() {
  const database = await prisma.$queryRaw`SELECT current_database() AS name`;
  if (database[0]?.name !== "goonginga_dev") {
    throw new Error(`Refusing verification against ${database[0]?.name || "an unknown database"}.`);
  }

  const admin = await prisma.networkMember.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, roles: true },
  });
  if (!admin) throw new Error("No active NetworkMember is available for verification.");

  const seasonEight = await prisma.tournament.findFirst({ orderBy: { id: "asc" } });
  if (!seasonEight) throw new Error("Season 8 is missing.");
  const originalState = seasonEight.state;
  const verificationName = `GGL Season 9 verification ${Date.now()}`;
  const token = jwt.sign(
    { id: admin.id, accountType: "NETWORK_MEMBER" },
    process.env.NETWORK_JWT_SECRET || process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  let createdId = null;

  try {
    if (!admin.roles.includes("ADMIN")) {
      await prisma.networkMember.update({
        where: { id: admin.id },
        data: { roles: [...admin.roles, "ADMIN"] },
      });
    }
    await prisma.tournament.update({ where: { id: seasonEight.id }, data: { state: "ROUNDROBIN" } });
    const blockedBySeasonEight = await request("/tournament/create", token, {
      method: "POST",
      body: JSON.stringify({ name: verificationName, startDate: "2026-09-01T00:00:00.000Z" }),
    });
    console.log("ACTIVE_SEASON_BLOCK", JSON.stringify(blockedBySeasonEight));

    await prisma.tournament.update({ where: { id: seasonEight.id }, data: { state: "FINISHED" } });
    const created = await request("/tournament/create", token, {
      method: "POST",
      body: JSON.stringify({ name: verificationName, startDate: "2026-09-01T00:00:00.000Z" }),
    });
    createdId = created.body?.id || null;
    console.log("CREATE_NEXT_SEASON", JSON.stringify(created));

    const blockedBySeasonNine = await request("/tournament/create", token, {
      method: "POST",
      body: JSON.stringify({ name: `${verificationName} duplicate`, startDate: "2027-01-01T00:00:00.000Z" }),
    });
    console.log("SECOND_ACTIVE_BLOCK", JSON.stringify(blockedBySeasonNine));
  } finally {
    if (createdId) await prisma.tournament.delete({ where: { id: createdId } });
    await prisma.tournament.update({ where: { id: seasonEight.id }, data: { state: originalState } });
    await prisma.networkMember.update({ where: { id: admin.id }, data: { roles: admin.roles } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
