// src/routes/leadRoutes.js

const express = require('express');
const router = express.Router();

// ✅ Importa o middleware corretamente
const { protect } = require('../middleware/authMiddleware');

// ✅ Importa o controller (sem "../src/")
const LeadController = require('../controllers/leadController');

// Verificação de segurança — evita crash se algo estiver errado no build
if (!LeadController || typeof LeadController.getAllLeads !== 'function') {
  console.error('❌ ERRO: LeadController não carregado corretamente!');
  throw new Error('LeadController inválido ou ausente.');
}

// ===================================
// ROTAS DE LEADS
// ===================================

// ⚠️ IMPORTANTE: as rotas mais específicas DEVEM vir antes das dinâmicas (/:id)

// ✅ Rota para buscar usuários para reatribuição (tem que vir antes de /:id)
router.get('/users/reassignment', protect, LeadController.getUsersForReassignment);

// ✅ Rotas principais de Leads
router.get('/', protect, LeadController.getAllLeads);
router.post('/', protect, LeadController.createLead);

// ✅ Rotas com parâmetro (id)
router.get('/:id', protect, LeadController.getLeadById);
router.put('/:id', protect, LeadController.updateLead);
router.delete('/:id', protect, LeadController.deleteLead);

module.exports = router;
