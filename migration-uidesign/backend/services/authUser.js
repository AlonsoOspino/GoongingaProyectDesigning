const memberRepo = require("../repositories/member");
const teamRepo = require("../repositories/team");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

// Roles that the admin "Register User" form is allowed to assign. Must mirror
// the Role enum in prisma/schema.prisma.
const ALLOWED_ROLES = new Set(["DEFAULT", "CAPTAIN", "MANAGER", "EDITOR", "ADMIN"]);

/**
 * REGISTER
 *
 * Accepts an optional `role` (defaults to DEFAULT) and optional `teamId`
 * (defaults to no team). The admin dashboard sends both of these when an
 * admin registers a user; the public registration flow simply omits them
 * and inherits the safe defaults.
 */
const register = async (data) => {
  if (!data) throw new Error("Body is missing");

  const { user, password, nickname, role: rawRole, teamId: rawTeamId } = data;

  if (!user || !password || !nickname) {
    throw new Error("user, password and nickname are required");
  }

  // Validate role. Empty/undefined falls back to DEFAULT.
  let role = "DEFAULT";
  if (rawRole !== undefined && rawRole !== null && rawRole !== "") {
    if (typeof rawRole !== "string" || !ALLOWED_ROLES.has(rawRole)) {
      throw new Error(
        `Invalid role. Allowed values: ${Array.from(ALLOWED_ROLES).join(", ")}`,
      );
    }
    role = rawRole;
  }

  // Validate teamId. Empty/null/undefined means "no team".
  let teamId = null;
  if (rawTeamId !== undefined && rawTeamId !== null && rawTeamId !== "") {
    const parsed = Number(rawTeamId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error("teamId must be a positive integer.");
    }
    const team = await teamRepo.findById(parsed);
    if (!team) {
      throw new Error(`Team with id ${parsed} does not exist.`);
    }
    teamId = parsed;
  }

  const existing = await memberRepo.findByUser(user);

  if (existing) throw new Error("User already exists");

  const hash = await bcrypt.hash(password, 10);

  return await memberRepo.create({
    user,
    nickname,
    passwordHash: hash,
    role,
    rank: 0,
    teamId,
  });
};

/**
 * LOGIN
 */
const login = async (data) => {
  if (!data) throw new Error("Body is missing");

  const { user, password } = data;

  if (!user || !password) {
    throw new Error("Missing credentials");
  }

  const member = await memberRepo.findByUser(user);

  if (!member) throw new Error("User not found");

  const isValid = await bcrypt.compare(password, member.passwordHash);

  if (!isValid) throw new Error("Invalid password");

  const token = jwt.sign(
    {
      id: member.id,
      role: member.role,
      teamId: member.teamId,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: member.id,
      nickname: member.nickname,
      role: member.role,
      teamId: member.teamId,
      profilePic: member.profilePic ?? null,
    },
  };
};



module.exports = {
  register,
  login
};
