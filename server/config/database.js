const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'], // Only log errors, not queries
});

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;

