// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ReportController = require('../controllers/ReportController');

router.use(protect);

// rota que o frontend chama para carregar lista de vendedores
router.get('/sellers', ReportController.getVendors);

// dashboard principal
router.get('/', ReportController.getReportData);
router.post('/', ReportController.getReportData);

// export
router.get('/export/csv', ReportController.exportCsv);
router.get('/export/pdf', ReportController.exportPdf);

// notes
router.get('/notes/:leadId', ReportController.getAnalyticNotes);

module.exports = router;
