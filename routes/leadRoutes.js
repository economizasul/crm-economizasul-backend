// routes/leadRoutes.js

const express = require('express');
const router = express.Router();
const LeadController = require('../controllers/LeadController');
const { protect } = require('../middleware/authMiddleware'); 

// ------------------------------------------------------------------
// ROTAS DE LEADS (CRUD) - TODAS PROTEGIDAS
// ------------------------------------------------------------------

router.get('/', protect, LeadController.getAllLeads);         // Listar Todos os Leads
router.get('/:id', protect, LeadController.getLeadById);     // Busca por ID (Corrigido)
router.post('/', protect, LeadController.createLead);        // Criar Novo Lead
router.put('/:id', protect, LeadController.updateLead);      // Atualizar Lead
router.delete('/:id', protect, LeadController.deleteLead);   // Excluir Lead

module.exports = router;