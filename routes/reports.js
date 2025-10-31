// src/routes/reports.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const db = require('../src/db');
const ReportController = require('../controllers/ReportController');
const { protect, admin } = require('../middleware/authMiddleware'); // Importar middlewares

// Rota para buscar vendedores (Mantida)
router.get('/sellers', async (req, res) => {
  try {
    // MUDANÇA CRÍTICA: De 'sellers' para 'users'
    const result = await pool.query('SELECT id, name FROM users ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar vendedores:', err);
    res.status(500).json({ error: err.message });
  }
});

// NOVO: Rota para buscar todos os dados do Dashboard (apenas para usuários autenticados)
router.get('/dashboard-data', protect, ReportController.getDashboardData);

// NOVO: Rota para exportação (apenas para usuários autenticados)
router.get('/export', protect, ReportController.exportReports);

module.exports = router;