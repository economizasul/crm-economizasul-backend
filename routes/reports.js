// routes/reports.js

const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');
// 🚨 Assumindo que você tem um middleware de autenticação
const { protect } = require('../middleware/authMiddleware'); 

// Aplica o middleware de proteção a todas as rotas de relatório
router.use(protect);

// 1. Rota de Vendedores (usada pelo FilterBar.jsx)
router.get('/sellers', ReportController.getVendors);

// 2. Rota de Dados do Dashboard (GET/POST para flexibilidade de filtros)
router.route('/data')
    .get(ReportController.getReportData)
    .post(ReportController.getReportData);

// 3. Rota de Exportação CSV
router.post('/export/csv', ReportController.exportCsv);

// 4. Rota de Exportação PDF
router.post('/export/pdf', ReportController.exportPdf);

module.exports = router;