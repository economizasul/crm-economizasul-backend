// src/routes/reports.js
const express = require('express');
const router = express.Router();
const db = require('../src/db');
const ReportController = require('../controllers/ReportController');
const { protect, admin } = require('../middleware/authMiddleware'); // Importar middlewares

// Rota para buscar vendedores (Mantida)
router.get('/sellers', async (req, res) => {
  try {
    // Melhor usar a função auxiliar se a lista de vendedores for necessária
    const result = await db.query('SELECT id, name FROM users WHERE role != $1 ORDER BY name', ['client']); // Assumindo que users armazena vendedores
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