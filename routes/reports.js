// routes/reports.js

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/ReportController');
const authMiddleware = require('../middleware/authMiddleware'); // Seu middleware de JWT

// Aplica o middleware de autenticação a todas as rotas de relatórios
router.use(authMiddleware);

/**
 * @route GET /api/reports/data
 * @description Retorna todos os dados para alimentar o dashboard (gráficos, tabelas).
 * @access Private (Auth Required)
 */
router.get('/data', reportController.getDashboardData);

/**
 * @route GET /api/reports/analytic
 * @description Retorna o relatório detalhado de atendimento para um Lead.
 * @access Private (Auth Required)
 */
router.get('/analytic', reportController.getAnalyticReport);


// Futuramente:
// router.get('/export/pdf', reportController.exportToPdf);
// router.get('/export/csv', reportController.exportToCsv);

module.exports = router;