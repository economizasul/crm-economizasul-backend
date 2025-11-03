// routes/reports.js

const express = require('express');
const router = express.Router();

// 1. Corrija o caminho de importação do Controller
// Se o Controller está em controllers/ReportController.js na raiz, o caminho é './controllers/ReportController'
// Se o Controller está em src/controllers/ReportController.js, o caminho é './src/controllers/ReportController'
// **Assumindo que está na raiz:**
const ReportController = require('../controllers/ReportController'); 

// 2. Assumindo que você tem um middleware de autenticação (isAuthenticated)

// Exemplo de Middleware:
const isAuthenticated = (req, res, next) => {
    // ESTE É APENAS UM MOCK. Use seu middleware real de autenticação e injeção de contexto!
    req.userId = req.user ? req.user.id : 1; 
    req.isAdmin = req.user ? req.user.role === 'admin' : true; 
    next();
};

// ===================================
// ROTAS DE RELATÓRIO
// ===================================

// Rota principal de dados do dashboard
router.get('/data', isAuthenticated, ReportController.getReportData);

// Rota de dados analíticos (Lead único)
router.get('/analytic', isAuthenticated, ReportController.getAnalyticNotes);

// ROTAS DE EXPORTAÇÃO (O erro ocorre aqui)
// Usando a instância e métodos "bindados" do ReportController:
router.get('/export/csv', isAuthenticated, ReportController.exportCsv);
router.get('/export/pdf', isAuthenticated, ReportController.exportPdf);

module.exports = router;