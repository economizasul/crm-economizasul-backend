// routes/reports.js

const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController'); 
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// 1. Rota de Vendedores
router.get('/sellers', ReportController.getVendors);

// 2. Rota de Dados do Dashboard
router.route('/data')
    .get(ReportController.getReportData)
    .post(ReportController.getReportData);

// 3. Rota do Mapa (FALTAVA AQUI)
router.post('/leads-ganho-mapa', ReportController.getLeadsGanhoParaMapa);

// 4. CSV
router.post('/export/csv', ReportController.exportCsv);

// 5. PDF
router.post('/export/pdf', ReportController.exportPdf);

// 6. Notas Analíticas
router.get('/analytic/:leadId', ReportController.getAnalyticNotes);

module.exports = router;
