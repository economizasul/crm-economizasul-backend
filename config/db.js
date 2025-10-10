// config/db.js
const { Pool } = require('pg');

// A variável DATABASE_URL é lida do ambiente (Render) ou do arquivo .env (local)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Função para garantir que a tabela de clientes exista
async function ensureTablesExist() {
  try {
    const createClientsTableQuery = `
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createClientsTableQuery);
    console.log('Postgres: Tabela "clients" verificada/criada com sucesso.');
  } catch (err) {
    console.error('Postgres: ERRO ao verificar/criar a tabela clients:', err);
  }
}

// Exporta o pool de conexão para ser usado pelos models
module.exports = {
  pool,
  ensureTablesExist,
};