
const memberService = require("../services/authUser");
const memberRepo = require("../repositories/member");

const register = async (req, res) => {
  try {
    const user = await memberService.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const login = async (req, res) => {
  try {
    const result = await memberService.login(req.body);
    res.json(result);
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};
const getAll = async (req, res) => {
  try {
    const members = await memberRepo.findAll();
    // Oculta el campo passwordHash en la respuesta
    const safeMembers = members.map(({ passwordHash, ...rest }) => rest);
    res.json(safeMembers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const getById = async (req, res) => {
  try {
    const member = await memberRepo.findById(Number(req.params.id));
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    // Oculta el campo passwordHash en la respuesta
    const { passwordHash, ...safeMember } = member;
    res.json(safeMember);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bcrypt = require("bcrypt");
const update = async (req, res) => {
  try {
    // Only allow self-update or admin
    if (req.user.id !== Number(req.params.id) && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Forbidden: You can only update your own profile." });
    }
    // Prevent role and team from being updated by users
    const { role, team, teamId, password, ...safeBody } = req.body;
    if (password) {
      safeBody.passwordHash = await bcrypt.hash(password, 10);
    }
    const updatedMember = await memberRepo.update(Number(req.params.id), safeBody);
    res.json(updatedMember);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
const adminUpdate = async (req, res) => {
  try {
    // Only allow admin to update role and team
    const { team, password, ...safeBody } = req.body;
    if (req.body.teamId !== undefined) {
      safeBody.teamId = Number(req.body.teamId);
    }
    if (password) {
      safeBody.passwordHash = await bcrypt.hash(password, 10);
    }
    const updatedMember = await memberRepo.update(Number(req.params.id), safeBody);
    res.json(updatedMember);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


module.exports = {
  register,
  login,
  getAll,
  getById,
  update,
  adminUpdate 
};
