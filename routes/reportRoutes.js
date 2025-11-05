// routes/reportRoutes.js

const express = require('express');
const router = express.Router();
// O middleware 'protect' garante que o usuário está logado
const { protect } = require('../middleware/authMiddleware'); 

// ⭐️ Ajuste o caminho se o seu 'ReportController.js' não estiver em 'controllers/'
const ReportController = require('../controllers/ReportController'); 

// Aplica o middleware de autenticação a todas as rotas de relatório
router.use(protect);

// 1. Rota Principal de Dados do Dashboard (GET/POST)
// Use POST se quiser passar filtros complexos no body, ou GET se for simples
router.get('/', ReportController.getReportData); 
router.post('/', ReportController.getReportData);

// 2. Exportação de Arquivos
router.get('/export/csv', ReportController.exportCsv);
router.get('/export/pdf', ReportController.exportPdf);

// 3. Notas Analíticas (se for uma rota separada)
router.get('/notes/:leadId', ReportController.getAnalyticNotes);


module.exports = router;