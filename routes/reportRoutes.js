// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ReportController = require('../controllers/ReportController');

router.use(protect);

router.get('/sellers', ReportController.getVendors);

// Permite compatibilidade com /reports e /reports/data
router.post('/', ReportController.getReportData);
router.post('/data', ReportController.getReportData);

router.get('/notes/:leadId', ReportController.getAnalyticNotes);

router.post('/export/csv', ReportController.exportCsv);
router.post('/export/pdf', ReportController.exportPdf);

module.exports = router;
