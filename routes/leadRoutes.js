const express = require('express');
const router = express.Router();
// Importa APENAS as funções que estão exportadas no leadController.js
const { 
    createLead, 
    getAllLeads,
    // As demais funções (getLeadById, updateLead, deleteLead) foram removidas
    // pois não foram implementadas no Controller na última limpeza.
} = require('../controllers/leadController'); 
const { protect } = require('../middleware/authMiddleware'); 
// A função 'admin' não é necessária pois não estamos usando a rota DELETE/PUT

// Rotas de Leads - Cadastro e Listagem (Foco Principal)

// POST /api/v1/leads - Cria um novo lead
router.post('/', protect, createLead);

// GET /api/v1/leads - Lista leads (Admin vê todos, User vê apenas os seus)
router.get('/', protect, getAllLeads);

// OBSERVAÇÃO: Rotas para Detalhes (GET /:id), Atualização (PUT /:id) e 
// Exclusão (DELETE /:id) foram temporariamente removidas. 
// Elas devem ser adicionadas aqui APENAS após serem implementadas no Controller.

module.exports = router;