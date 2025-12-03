// models/Lead.js - VERSÃO FINAL CORRIGIDA
const { pool } = require('../config/db');

const Lead = {

  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        phone2 VARCHAR(50),                
        document VARCHAR(50),
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
        cidade VARCHAR(255),
        regiao VARCHAR(255),
        google_maps_link TEXT,
        kw_sold DOUBLE PRECISION DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        reason_for_loss VARCHAR(255),
        seller_id VARCHAR(255),
        seller_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_won TIMESTAMP
      );
    `);
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT l.*, u.name AS owner_name 
       FROM leads l
       LEFT JOIN users u ON u.id = l.owner_id
       WHERE l.id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findAll(params) {
    let query = `
      SELECT l.*, u.name AS owner_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.owner_id
      WHERE 1 = 1
    `;

    const values = [];
    let idx = 1;

    if (params.status) {
      query += ` AND l.status = $${idx++}`;
      values.push(params.status);
    }

    if (params.search) {
      query += ` AND (l.name ILIKE $${idx} OR l.phone ILIKE $${idx} OR l.email ILIKE $${idx})`;
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.userRole !== 'Admin') {
      query += ` AND l.owner_id = $${idx++}`;
      values.push(params.ownerId);
    } else if (params.ownerId) {
      query += ` AND l.owner_id = $${idx++}`;
      values.push(params.ownerId);
    }

    query += ` ORDER BY l.created_at DESC`;

    const { rows } = await pool.query(query, values);
    return rows;
  },

  async insert(payload) {
    const fields = [
      'name','email','phone','phone2','document','address','status','origin','owner_id',
      'uc','avg_consumption','estimated_savings','qsa','notes',
      'lat','lng','cidade','regiao','google_maps_link',
      'kw_sold','metadata','reason_for_loss','seller_id','seller_name'
    ];

    const vals = fields.map(f => payload[f] ?? null);
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');

    const query = `
      INSERT INTO leads (${fields.join(',')})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const { rows } = await pool.query(query, vals);
    return rows[0];
  },

  async update(id, payload) {
    const fields = Object.keys(payload);
    if (!fields.length) return null;

    const setExpressions = fields.map((key, i) => `${key} = $${i + 1}`);
    const values = Object.values(payload);

    const query = `
      UPDATE leads
      SET ${setExpressions.join(', ')}, updated_at = NOW()
      WHERE id = $${fields.length + 1}
      RETURNING *;
    `;

    const { rows } = await pool.query(query, [...values, id]);
    return rows[0] || null;
  },

  async delete(id) {
    await pool.query('DELETE FROM leads WHERE id = $1', [id]);
    return true;
  }
};

module.exports = Lead;