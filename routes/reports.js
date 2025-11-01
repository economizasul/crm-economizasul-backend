// routes/reports.js
const express = require('express');
const router = express.Router();

const ReportController = require('../controllers/ReportController');
const { protect } = require('../middleware/authMiddleware');

// Rota para dashboard principal (metrics)
router.get('/dashboard-data', protect, ReportController.getDashboardData);

// Rota para export (csv / pdf)
router.get('/export', protect, ReportController.exportReports);

// Rota para obter lista de vendedores (usuários ativos)
// Esta rota é usada pelo frontend em ReportsPage.jsx -> api.get('/reports/sellers')
router.get('/sellers', protect, async (req, res) => {
  try {
    // Query simples para retornar id e name dos usuários ativos
    const { pool } = require('../config/db');
    const result = await pool.query(`SELECT id, name FROM users WHERE is_active = true ORDER BY name`);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar vendedores (sellers):', error);
    res.status(500).json({ error: 'Erro interno ao buscar vendedores.' });
  }
});

module.exports = router;
