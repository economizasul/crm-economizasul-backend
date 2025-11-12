// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // ✅ Importa função corretamente
const ReportController = require('../controllers/ReportController');

// Protege todas as rotas
router.use(protect);

// 🔹 Lista de vendedores
router.get('/sellers', ReportController.getVendors);

// 🔹 Dados do dashboard
router.post('/data', ReportController.getReportData);

// 🔹 Notas analíticas
router.get('/notes/:leadId', ReportController.getAnalyticNotes);

// 🔹 Exportações
router.post('/export/csv', ReportController.exportCsv);
router.post('/export/pdf', ReportController.exportPdf);

module.exports = router;
