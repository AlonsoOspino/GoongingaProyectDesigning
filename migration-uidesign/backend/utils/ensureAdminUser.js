// utils/ensureAdminUser.js
//
// Bootstraps a guaranteed admin account on every server start (and therefore
// on every deployment, since deployments restart the server).
//
// Behavior:
//   1. If at least one Member with role = ADMIN already exists, do nothing.
//   2. Otherwise:
//        - If a Member with user = "Admin" exists, promote that row to ADMIN
//          and reset its password to the canonical bootstrap password.
//        - If no such row exists, create one.
//
// Credentials are intentionally hardcoded per product requirement.
// They can be overridden via environment variables in case we ever want to
// rotate them without a code change:
//   ADMIN_BOOTSTRAP_USER     (default: "Admin")
//   ADMIN_BOOTSTRAP_PASSWORD (default: "THERATISTHEGOAT")
//   ADMIN_BOOTSTRAP_NICKNAME (default: "Admin")

const bcrypt = require("bcrypt");
const prisma = require("../config/prisma");

const ADMIN_USER = process.env.ADMIN_BOOTSTRAP_USER || "Admin";
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || "THERATISTHEGOAT";
const ADMIN_NICKNAME = process.env.ADMIN_BOOTSTRAP_NICKNAME || "Admin";

async function ensureAdminUser() {
  // 1. Is there already at least one ADMIN? Nothing to do.
  const existingAdmin = await prisma.member.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, user: true },
  });

  if (existingAdmin) {
    console.log(
      `[ensureAdminUser] Admin already present (id=${existingAdmin.id}, user="${existingAdmin.user}"). Skipping bootstrap.`,
    );
    return { created: false, promoted: false };
  }

  // 2. No admin exists. Bootstrap one.
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const collision = await prisma.member.findUnique({
    where: { user: ADMIN_USER },
    select: { id: true },
  });

  if (collision) {
    // Username already taken by a non-admin row -> promote it.
    await prisma.member.update({
      where: { id: collision.id },
      data: {
        role: "ADMIN",
        passwordHash,
        nickname: ADMIN_NICKNAME,
      },
    });
    console.log(
      `[ensureAdminUser] No ADMIN found. Promoted existing user "${ADMIN_USER}" (id=${collision.id}) to ADMIN.`,
    );
    return { created: false, promoted: true };
  }

  const created = await prisma.member.create({
    data: {
      user: ADMIN_USER,
      nickname: ADMIN_NICKNAME,
      passwordHash,
      role: "ADMIN",
      rank: 0,
    },
    select: { id: true, user: true },
  });
  console.log(
    `[ensureAdminUser] No ADMIN found. Created new admin user "${created.user}" (id=${created.id}).`,
  );
  return { created: true, promoted: false };
}

module.exports = { ensureAdminUser };
