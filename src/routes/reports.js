// src/routes/reports.js

const express = require('express');
const router = express.Router();

// Controlador
const ReportController = require('../controllers/ReportController');

// Middleware de autenticação real
const { protect } = require('../middleware/authMiddleware');

// ROTAS DE RELATÓRIOS
router.get('/data', protect, ReportController.getReportData);
router.get('/analytic', protect, ReportController.getAnalyticNotes);

// ROTAS DE EXPORTAÇÃO
router.get('/export/csv', protect, ReportController.exportCsv);
router.get('/export/pdf', protect, ReportController.exportPdf);

module.exports = router;
