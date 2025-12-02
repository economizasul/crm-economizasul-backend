// config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * ensureSchemaSafe
 * Cria esquema/tabelas necessárias SE NÃO EXISTIREM.
 * NÃO DROPA tabelas. Uso seguro em produção.
 */
async function ensureSchemaSafe() {
  // Cria apenas se não existir (non-destructive)
  try {
    // users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'User',
        is_active BOOLEAN DEFAULT true,
        relatorios_proprios_only BOOLEAN DEFAULT false,
        relatorios_todos BOOLEAN DEFAULT false,
        transferencia_leads BOOLEAN DEFAULT false,
        acesso_configuracoes BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // clients (light)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // leads (full set of fields used by reports)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        document VARCHAR(100),
        address TEXT,
        status VARCHAR(100) DEFAULT 'Novo',
        origin VARCHAR(100),
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        uc VARCHAR(255),
        avg_consumption DOUBLE PRECISION,
        estimated_savings DOUBLE PRECISION,
        qsa TEXT,
        notes TEXT,
        lat NUMERIC,
        lng NUMERIC,
        cidade VARCHAR(255),         /* 🟢 ADICIONADO */
        regiao VARCHAR(255),         /* 🟢 ADICIONADO */
        google_maps_link TEXT,       /* 🟢 ADICIONADO */
        kw_sold DOUBLE PRECISION DEFAULT 0, /* 🟢 ADICIONADO */
        metadata JSONB DEFAULT '{}'::jsonb,
        reason_for_loss VARCHAR(255),
        seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL, /* 🟢 ADICIONADO */
        seller_name VARCHAR(255),     /* 🟢 ADICIONADO */
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        date_won TIMESTAMP WITHOUT TIME ZONE
      );
    `);
    
    // Create minimal admin user if not exists (safe: won't override)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@economizasul.com';
    const adminCheck = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [adminEmail]);
    if (adminCheck.rowCount === 0) {
      // don't create a real password here in production; using environment or manual seeding is safer
      console.log(`Admin user (${adminEmail}) not found. Create one manually or set env ADMIN_* vars.`);
    }

    console.log('DB schema ensured (non-destructive).');
  } catch (err) {
    console.error('Error ensuring DB schema:', err);
    throw err;
  }
}

module.exports = {
  pool,
  ensureSchemaSafe,
};