// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/ReportController');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ Garante autenticação em todas as rotas
router.use(authMiddleware);

// 🔹 Rota para obter vendedores
router.get('/sellers', reportController.getVendors);

// 🔹 Rota principal do dashboard (⚠️ precisa aceitar POST!)
router.post('/data', reportController.getReportData);

// 🔹 Rota para notas analíticas
router.get('/notes/:leadId', reportController.getAnalyticNotes);

// 🔹 Exportações
router.post('/export/csv', reportController.exportCsv);
router.post('/export/pdf', reportController.exportPdf);

module.exports = router;
