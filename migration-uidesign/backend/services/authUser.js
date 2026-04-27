const memberRepo = require("../repositories/member");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

/**
 * REGISTER
 */
const register = async (data) => {
  if (!data) throw new Error("Body is missing");

  const { user, password, nickname } = data;

  if (!user || !password || !nickname) {
    throw new Error("user, password and nickname are required");
  }

  const existing = await memberRepo.findByUser(user);

  if (existing) throw new Error("User already exists");

  const hash = await bcrypt.hash(password, 10);

  return await memberRepo.create({
    user,
    nickname,
    passwordHash: hash,
    role: "DEFAULT",
    rank: 0,
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
