// routes/reports.js

const express = require('express');
const router = express.Router();
// O ReportController agora importa a classe com métodos estáticos.
const ReportController = require('../controllers/ReportController'); 
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// 1. Rota de Vendedores
router.get('/sellers', ReportController.getVendors);

// 2. Rota de Dados do Dashboard
router.route('/data')
    .get(ReportController.getReportData)
    .post(ReportController.getReportData);

// 3. Rota de Exportação CSV (Usamos POST para enviar filtros no corpo)
router.post('/export/csv', ReportController.exportCsv);

// 4. Rota de Exportação PDF (Usamos POST para enviar filtros no corpo)
router.post('/export/pdf', ReportController.exportPdf);

// 5. Rota de Notas Analíticas (se for usada)
router.get('/analytic/:leadId', ReportController.getAnalyticNotes);


module.exports = router;