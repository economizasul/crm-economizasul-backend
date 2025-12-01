// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ReportController = require('../controllers/ReportController');

// Aplica proteção global a todas as rotas
router.use(protect);

router.get('/sellers', ReportController.getVendors);

router.post('/', ReportController.getReportData);
router.post('/data', ReportController.getReportData);

// NOVA ROTA PARA O MAPA INTERATIVO
router.post('/leads-ganho-mapa', ReportController.getLeadsGanhoParaMapa);

router.get('/notes/:leadId', ReportController.getAnalyticNotes);

router.post('/export/csv', ReportController.exportCsv);
router.post('/export/pdf', ReportController.exportPdf);

// CORREÇÃO: passar apenas a função protect
router.post('/motivos-perda', protect, ReportController.getLossReasons);

module.exports = router;
