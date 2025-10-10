// config/db.js

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
}); // ⬅️ CORREÇÃO 1: Faltava o fechamento do objeto e do construtor da Pool

// Função que cria as tabelas se elas não existirem (requerida pelo app.js)
const ensureTablesExist = async () => {
    try {
        // SQL para criar a tabela 'users' (necessária para login)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // SQL para criar a tabela 'clients' (necessária para o GET /clients)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(50),
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabelas 'users' e 'clients' verificadas/criadas com sucesso.");
    } catch (err) {
        console.error("ERRO FATAL: Não foi possível criar ou verificar as tabelas.", err);
        throw err; 
    }
};


module.exports = {
  pool,
  ensureTablesExist, // ⬅️ CORREÇÃO 2: A função agora está definida e é exportada
};