// Usage: node seed-users.js
// This script will create users with random passwords in the database.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const prisma = new PrismaClient();

const users = [
  'Jared',
  'MiracleMax',
  'michaeng.jpg',
  'bigbobman',
  'splatisawesome',
  'Pmarmen',
  'slimean101',
  'John Eugeo',
  'nightmarencb',
  'cyber3508',
  'kayjun',
  'philcon1996',
  'LegosGuy',
  'ammosam',
  'wadoiscool',
  'Deathoof',
  'imaqinewaqons',
  'chandra_lmt',
  'Notshell',
  'Mymemeistrue',
  'snowysnowcat',
  'JP',
  'IAmBrCe',
  'Deathmatcher9',
  'ArmaKiri',
  'wishfulgiant',
  'Puls0r',
  'Spry',
  'mentalblocked',
  'theonlytonk',
  'little',
  'AddieBC1',
  'Arterratitaaa#8799',
  'XakoHD',
  'uselessnarukami',
  'Huntaio',
  'BigMoneyBadBoy',
  'g_dave46',
  'Scindel',
  'SparkZzie',
];

function generatePassword(length = 12) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

async function main() {
  for (const user of users) {
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const created = await prisma.member.create({
        data: {
          nickname: user,
          user: user,
          passwordHash,
          role: 'DEFAULT',
        },
      });
      console.log(`Created user: ${user} | Password: ${password}`);
    } catch (err) {
      console.error(`Failed to create user ${user}:`, err.message);
    }
  }
  await prisma.$disconnect();
}

main();
