// models/Lead.js
const pool = require('../db');


const Lead = {
  async createTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
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
      google_maps_link,
      kw_sold DOUBLE PRECISION DEFAULT 0,
      metadata JSONB DEFAULT '{}'::jsonb,
      reason_for_loss VARCHAR(255),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      date_won TIMESTAMP WITHOUT TIME ZONE,

      -- 🔴 CORREÇÕES REQUERIDAS
      cidade VARCHAR(255),
      regiao VARCHAR(255),
      google_maps_link TEXT
    );
  `);
},

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT l.*, u.name AS owner_name 
       FROM leads l 
       LEFT JOIN users u ON u.id = l.owner_id 
       WHERE l.id = $1 
       LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async findAll({ status, ownerId, search, userRole }) {
    let query = `
      SELECT l.*, u.name AS owner_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.owner_id
      WHERE 1=1
    `;
    const values = [];
    let idx = 1;

    if (status) {
      query += ` AND l.status = $${idx++}`;
      values.push(status);
    }

    if (search) {
      query += ` AND (l.name ILIKE $${idx} OR l.phone ILIKE $${idx} OR l.email ILIKE $${idx})`;
      values.push(`%${search}%`);
      idx++;
    }

    if (userRole !== 'Admin') {
      if (ownerId) {
        query += ` AND l.owner_id = $${idx++}`;
        values.push(ownerId);
      }
    } else if (ownerId) {
      query += ` AND l.owner_id = $${idx++}`;
      values.push(ownerId);
    }

    query += ` ORDER BY l.created_at DESC`;

    const { rows } = await pool.query(query, values);
    return rows;
  },

  async insert(payload) {
    const fields = [
       'name','email','phone','document','address','status','origin','owner_id',
       'uc','avg_consumption','estimated_savings','qsa','notes','lat','lng',
       'kw_sold','metadata','reason_for_loss',
       'cidade', 'regiao', 'google_maps_link'
    ];

    const vals = fields.map(f => payload[f] === undefined ? null : payload[f]);
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');

    const q = `
      INSERT INTO leads (${fields.join(',')}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;
    const { rows } = await pool.query(q, vals);
    return rows[0];
  }
};

module.exports = Lead;
