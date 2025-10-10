// config/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Função para garantir que todas as tabelas existam (clients E users)
async function ensureTablesExist() {
  try {
    // 1. Cria Tabela de Usuários/Vendedores
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'sales' NOT NULL, -- 'admin' ou 'sales'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createUsersTableQuery);
    console.log('Postgres: Tabela "users" verificada/criada com sucesso.');
    
    // 2. Cria Tabela de Clientes (Já existente)
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
    console.error('Postgres: ERRO ao verificar/criar tabelas:', err);
  }
}

module.exports = {
  pool,
  ensureTablesExist,
};