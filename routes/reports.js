// routes/reports.js (Versão Final Otimizada)

const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// 1. Rota de Dados do Dashboard
// Permite GET (filtros na query) e POST (filtros no body)
router.route('/data')
    .get(ReportController.getReportData)
    .post(ReportController.getReportData);

// 2. Notas Analíticas (GET está correto)
router.get('/analytic/:leadId', ReportController.getAnalyticNotes);

// 3. Exportação (Usando GET, pois é uma busca/download)
// Mudar de .post para .get para seguir a semântica de download/busca, 
// a menos que os filtros sejam grandes demais para a URL.
router.get('/export/csv', ReportController.exportCsv);
router.get('/export/pdf', ReportController.exportPdf);

module.exports = router;