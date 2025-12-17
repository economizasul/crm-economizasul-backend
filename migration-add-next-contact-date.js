// migration-add-next-contact-date.js
const { pool } = require('./config/db');

async function runMigration() {
  try {
    await pool.query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS next_contact_date TIMESTAMP;
    `);
    console.log('✅ Coluna next_contact_date adicionada com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error);
    process.exit(1);
  }
}

runMigration();