/**
 * Migration script to add medication_type column to existing medications table
 * Run this script once to update existing medications to have a default type
 * 
 * Usage: node scripts/add-medication-type.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addMedicationType() {
  try {
    console.log('🔄 Starting migration to add medication_type column...');

    // Check if column already exists by trying to query it
    try {
      await prisma.$queryRaw`SELECT medication_type FROM medications LIMIT 1`;
      console.log('✅ medication_type column already exists');
      return;
    } catch (error) {
      if (error.message && error.message.includes("Unknown column 'medication_type'")) {
        console.log('📝 Column does not exist, adding it...');
      } else {
        // Column might exist, or there's another issue
        console.log('⚠️ Could not check column status, attempting to add...');
      }
    }

    // Add the column using raw SQL
    await prisma.$executeRaw`
      ALTER TABLE medications 
      ADD COLUMN medication_type VARCHAR(191) DEFAULT 'tablet'
    `;

    console.log('✅ medication_type column added successfully');

    // Update all existing medications to have 'tablet' as default if they're null
    const updated = await prisma.$executeRaw`
      UPDATE medications 
      SET medication_type = 'tablet' 
      WHERE medication_type IS NULL
    `;

    console.log(`✅ Updated ${updated} existing medications with default type 'tablet'`);
    console.log('✅ Migration completed successfully');

  } catch (error) {
    if (error.message && error.message.includes('Duplicate column name')) {
      console.log('✅ medication_type column already exists');
    } else {
      console.error('❌ Error during migration:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
addMedicationType()
  .then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

