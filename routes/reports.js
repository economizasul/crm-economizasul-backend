// routes/reports.js

const express = require('express');
const router = express.Router();

// CORREÇÃO: Destruturar (extrair) a função 'protect' do objeto exportado.
const { protect } = require('../middleware/authMiddleware'); 
const reportController = require('../controllers/ReportController'); 

// APLICAÇÃO DO MIDDLEWARE: Agora 'protect' é uma função válida.
router.use(protect); 

/**
 * @route GET /api/reports/data
 * @description Retorna todos os dados para alimentar o dashboard (gráficos, tabelas).
 * @access Private (Auth Required)
 */
router.get('/data', reportController.getDashboardData);

// ... (Outras rotas permanecem as mesmas)
router.get('/analytic', reportController.getAnalyticReport);
router.get('/export/csv', reportController.exportToCsv);
router.get('/export/pdf', reportController.exportToPdf);

module.exports = router;