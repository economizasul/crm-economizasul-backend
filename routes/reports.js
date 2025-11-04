// routes/reports.js
const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/data', ReportController.getReportData);
router.get('/analytic/:leadId', ReportController.getAnalyticNotes);
router.post('/export/csv', ReportController.exportCsv);
router.post('/export/pdf', ReportController.exportPdf);

module.exports = router;