const prisma = require("../config/prisma");

const create = (data) => prisma.member.create({ data });

const findByUser = (user) => 
  prisma.member.findUnique({ where: { user } });

const findById = (id) =>
  prisma.member.findUnique({ where: { id: Number(id) } });

const findAll = () => prisma.member.findMany();

const update = (id, data) =>
  prisma.member.update({ where: { id: Number(id) }, data }); 


module.exports = {
  create,
  findByUser,
  findById,
  findAll,
  update,
};