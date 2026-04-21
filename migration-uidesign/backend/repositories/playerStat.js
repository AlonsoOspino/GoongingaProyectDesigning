const prisma = require("../config/prisma");

const create = (data) => prisma.playerStat.create({ data });

const findAll = () =>
  prisma.playerStat.findMany({
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          user: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

const findByUserId = (userId) =>
  prisma.playerStat.findMany({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          user: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

const findAllPublic = () =>
  prisma.playerStat.findMany({
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

const findByUserIdPublic = (userId) =>
  prisma.playerStat.findMany({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

module.exports = {
  create,
  findAll,
  findByUserId,
  findAllPublic,
  findByUserIdPublic,
};
