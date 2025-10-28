const express = require('express');
const router = express.Router();
const pool = require('../db'); // seu pool do PostgreSQL

router.get('/sellers', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM sellers ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;