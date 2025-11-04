// src/routes/reports.js

const express = require('express');
const router = express.Router();

// ✅ Caminho correto do controller
const ReportController = require('../controllers/ReportController');

// ✅ Middleware real de autenticação
const protect = require('../middleware/authMiddleware');

// ===================================
// ROTAS DE RELATÓRIOS
// ===================================

// Dados principais do dashboard
router.get('/data', protect, ReportController.getReportData);

// Dados analíticos de leads
router.get('/analytic', protect, ReportController.getAnalyticNotes);

// Exportações
router.get('/export/csv', protect, ReportController.exportCsv);
router.get('/export/pdf', protect, ReportController.exportPdf);

module.exports = router;
