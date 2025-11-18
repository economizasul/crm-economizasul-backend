// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ReportController = require('../controllers/ReportController');

router.use(protect);

router.get('/sellers', ReportController.getVendors);

router.post('/', ReportController.getReportData);
router.post('/data', ReportController.getReportData);

// NOVA ROTA PARA O MAPA INTERATIVO
router.post('/leads-ganho-mapa', ReportController.getLeadsGanhoParaMapa);

router.get('/notes/:leadId', ReportController.getAnalyticNotes);

router.post('/export/csv', ReportController.exportCsv);
router.post('/export/pdf', ReportController.exportPdf);

module.exports = router;