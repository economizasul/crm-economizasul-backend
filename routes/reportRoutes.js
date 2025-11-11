// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const ReportController = require('../controllers/ReportController');

// 🔒 Protege todas as rotas
router.use(protect);

// 👥 Rota para buscar vendedores reais (usada pela tela de relatórios)
router.get('/sellers', ReportController.getSellers);

// 📊 Dashboard principal
router.get('/', ReportController.getReportData);
router.post('/', ReportController.getReportData);

// 📄 Exportações
router.get('/export/csv', ReportController.exportCsv);
router.get('/export/pdf', ReportController.exportPdf);

// 📝 Notas analíticas
router.get('/notes/:leadId', ReportController.getAnalyticNotes);

module.exports = router;
