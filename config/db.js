// config/db.js

// 1. IMPORTAÇÕES NO TOPO (Usando o 'bcrypt' que está no seu package.json)
const bcrypt = require('bcrypt'); 
const { Pool } = require('pg');
require('dotenv').config(); 

// 2. CONFIGURAÇÃO DE CONEXÃO
// NOTE: 'new' é usado apenas uma vez.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// 3. GARANTE QUE AS TABELAS E O ADMIN EXISTAM
const ensureTablesExist = async () => {
    try {
        
        // ⚠️ Força a recriação das tabelas para garantir colunas e limpar dados
        // Usamos CASCADE para remover referências (Foreign Keys) antes de deletar.
        await pool.query(`DROP TABLE IF EXISTS leads CASCADE;`);
        await pool.query(`DROP TABLE IF EXISTS clients CASCADE;`);
        await pool.query(`DROP TABLE IF EXISTS users CASCADE;`);


        // 1. Tabela 'users'
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
        
        // 2. Tabela 'clients'
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100),
                phone VARCHAR(50),
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // 3. Tabela 'leads'
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

        // 4. 🔑 GARANTIR USUÁRIO ADMIN (Chave Estrangeira)
        const checkUser = await pool.query(`SELECT id FROM users WHERE email = $1`, ['admin@economizasul.com']);
        
        if (checkUser.rows.length === 0) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('SenhaSegura123', salt);
            
            // Inserção do admin com ID fixo 1
            await pool.query(
                `INSERT INTO users (id, name, email, password, role)
                 VALUES (1, 'Admin Padrão', 'admin@economizasul.com', $1, 'admin')
                 ON CONFLICT (id) DO NOTHING`, 
                 [hashedPassword]
            );
            // Reseta a sequência para que novos usuários usem o próximo ID disponível (a partir do 2)
            await pool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));`);
            
            console.log("✅ Usuário admin@economizasul.com garantido (ID 1).");
        }

        console.log("Tabelas (users, clients, leads) verificadas/criadas com sucesso.");
    } catch (err) {
        console.error("ERRO FATAL: Não foi possível criar ou verificar as tabelas.", err);
        throw err; 
    }
};


module.exports = {
    pool,
    ensureTablesExist
};
