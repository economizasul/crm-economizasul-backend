// models/User.js
const { pool } = require('../config/db');


const User = {
  async createTable() {
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
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, is_active, relatorios_proprios_only, relatorios_todos, transferencia_leads, acesso_configuracoes FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  // métodos auxiliares básicos (criar usuário) - útil para seeds
  async create({ name, email, password, role = 'User' }) {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, email, password, role]
    );
    return rows[0];
  }
};

module.exports = User;
