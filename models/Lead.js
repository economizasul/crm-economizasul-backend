// models/Lead.js
const { pool } = require('../config/db');

const Lead = {

  async createTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        phone2 VARCHAR(50),  /* 🟢 Adicionado phone2 (Limpo) */
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
      const searchPattern = `%${params.search}%`;
      query += ` AND (
        l.name ILIKE $${idx} OR
        l.phone ILIKE $${idx} OR
        l.email ILIKE $${idx} OR
        l.document ILIKE $${idx} OR
        l.uc ILIKE $${idx}
      )`;
      values.push(searchPattern);
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

  // 🟢🟢🟢 LOG AQUI — ANTES DO INSERT
  async insert(payload) {
    console.log("📥 PAYLOAD RECEBIDO NO INSERT:", payload);

    if (!payload || typeof payload !== 'object') return null;

    // 🔄 Converte camelCase → snake_case para compatibilidade com o banco
    const mapping = {
      avgConsumption: 'avg_consumption',
      estimatedSavings: 'estimated_savings',
      reasonForLoss: 'reason_for_loss',
      sellerId: 'seller_id',
      sellerName: 'seller_name',
      ownerId: 'owner_id',
      kwSold: 'kw_sold',
      googleMapsLink: 'google_maps_link',
    };

    const normalizedPayload = {};
    for (const [key, value] of Object.entries(payload)) {
      const dbKey = mapping[key] || key;
      normalizedPayload[dbKey] = value;
    }

    // 🧩 Lista dos campos válidos existentes na tabela
    const fields = [
      'name', 'email', 'phone', 'phone2', 'document', 'address',
      'status', 'origin', 'owner_id', 'uc',
      'avg_consumption', 'estimated_savings', 'qsa', 'notes',
      'lat', 'lng', 'cidade', 'regiao', 'google_maps_link',
      'kw_sold', 'metadata', 'reason_for_loss', 'seller_id', 'seller_name'
    ];

    const filteredFields = fields.filter(f => f in normalizedPayload);
    const values = filteredFields.map(f => normalizedPayload[f] ?? null);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(',');

    const query = `
      INSERT INTO leads (${filteredFields.join(',')})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  // 🟢🟢🟢 LOG AQUI — ANTES DO UPDATE
  async update(id, payload) {
    console.log("📥 PAYLOAD RECEBIDO NO UPDATE:", payload);

    if (!payload || typeof payload !== 'object') return null;

    // 🔄 Converte camelCase → snake_case para compatibilidade com o banco
    const mapping = {
      avgConsumption: 'avg_consumption',
      estimatedSavings: 'estimated_savings',
      reasonForLoss: 'reason_for_loss',
      sellerId: 'seller_id',
      sellerName: 'seller_name',
      ownerId: 'owner_id',
      kwSold: 'kw_sold',
      googleMapsLink: 'google_maps_link',
    };

    const normalizedPayload = {};
    for (const [key, value] of Object.entries(payload)) {
      const dbKey = mapping[key] || key;
      normalizedPayload[dbKey] = value;
    }

    // 🧩 Gera dinamicamente os campos para o UPDATE
    const fields = Object.keys(normalizedPayload);
    if (!fields.length) return null;

    const setExpressions = fields.map((key, i) => `${key} = $${i + 1}`);
    const values = Object.values(normalizedPayload);

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
