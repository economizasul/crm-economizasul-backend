// routes/reports.js
const express = require('express');
const router = express.Router();

const ReportController = require('../controllers/ReportController');
const { protect } = require('../middleware/authMiddleware');

// Rota para dashboard principal (metrics)
router.get('/dashboard-data', protect, async (req, res, next) => {
  console.log(`[reports] incoming GET /dashboard-data from user=${req.user?.id || 'anon'} query=${JSON.stringify(req.query)}`);
  try {
    return await ReportController.getDashboardData(req, res, next);
  } catch (err) {
    console.error('[reports] error in /dashboard-data route handler:', err);
    return res.status(500).json({ error: 'Erro interno ao processar /dashboard-data' });
  }
});

// Rota para export (csv / pdf)
router.get('/export', protect, async (req, res, next) => {
  console.log(`[reports] incoming GET /export from user=${req.user?.id || 'anon'} query=${JSON.stringify(req.query)}`);
  try {
    return await ReportController.exportReports(req, res, next);
  } catch (err) {
    console.error('[reports] error in /export route handler:', err);
    return res.status(500).json({ error: 'Erro interno ao processar /export' });
  }
});

// Rota para obter lista de vendedores (sellers)
router.get('/sellers', protect, async (req, res) => {
  console.log(`[reports] incoming GET /sellers from user=${req.user?.id || 'anon'}`);
  try {
    const { pool } = require('../config/db');
    const result = await pool.query(`SELECT id, name FROM users WHERE is_active = true ORDER BY name`);
    return res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar vendedores (sellers):', error);
    return res.status(500).json({ error: 'Erro interno ao buscar vendedores.' });
  }
});

module.exports = router;
