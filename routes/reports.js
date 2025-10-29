// src/routes/reports.js
const express = require('express');
const router = express.Router();
const db = require('../src/db');

router.get('/sellers', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name FROM sellers ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar vendedores:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;