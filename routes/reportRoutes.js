// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ReportController = require('../controllers/ReportController');

// 🔒 Middleware de autenticação em todas as rotas
router.use(protect);

router.get('/sellers', ReportController.getSellers);

// 📊 Dashboard principal
router.get('/', ReportController.getReportData);
router.post('/', ReportController.getReportData);

// 👥 Nova rota para listar vendedores reais
router.get('/vendors', ReportController.getVendors);

// 📄 Exportações
router.get('/export/csv', ReportController.exportCsv);
router.get('/export/pdf', ReportController.exportPdf);

// 📝 Notas analíticas
router.get('/notes/:leadId', ReportController.getAnalyticNotes);

module.exports = router;
