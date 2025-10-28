// src/db/index.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Log de conexão
pool.on('connect', () => {
  console.log('Conectado ao PostgreSQL com sucesso!');
});

pool.on('error', (err) => {
  console.error('Erro na conexão com o banco:', err.stack);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};