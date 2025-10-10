// config/db.js

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
}); // ⬅️ CORREÇÃO 1: Faltava o fechamento do objeto e do construtor da Pool

// config/db.js (Dentro da função ensureTablesExist)

const ensureTablesExist = async () => {
    try {
        // 1. Tabela 'users' (necessária para login)
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
        // 2. Tabela 'clients' (para clientes ativos)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(50),
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // 3. 🆕 NOVA TABELA: 'leads' (para prospects e oportunidades)
        await pool.query(`DROP TABLE IF EXISTS leads;`); 

        await pool.query(`
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(50),
                status VARCHAR(50) DEFAULT 'Novo',
                source VARCHAR(100),
                owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabelas 'users', 'clients', e 'leads' verificadas/criadas com sucesso.");
    } catch (err) {
        console.error("ERRO FATAL: Não foi possível criar ou verificar as tabelas.", err);
        throw err; 
    }
};

// ... o restante do db.js com a exportação (module.exports = { pool, ensureTablesExist };)


module.exports = {
  pool,
  ensureTablesExist, // ⬅️ CORREÇÃO 2: A função agora está definida e é exportada
};