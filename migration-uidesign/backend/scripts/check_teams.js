const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.team.count();
  console.log('Team count:', count);
  const sample = await prisma.team.findMany({ take: 5 });
  console.log('Sample teams (up to 5):', sample);
}

main()
  .catch((e) => {
    console.error('Error querying teams:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
