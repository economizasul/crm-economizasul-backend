// src/routes/leadRoutes.js

const express = require('express');
const router = express.Router();

// ✅ Middleware de autenticação
const { protect } = require('../middleware/authMiddleware');

// ✅ Controller com importação correta
const LeadController = require('../controllers/leadController');

// ✅ Verificação defensiva (ajuda no deploy Render)
if (!LeadController || typeof LeadController.getAllLeads !== 'function') {
  console.error('❌ LeadController inválido ou incompleto:', LeadController);
  throw new Error('LeadController não exporta as funções esperadas.');
}

// ===================================
// ROTAS DE LEADS
// ===================================

// Lista e criação de leads
router.get('/', protect, LeadController.getAllLeads);
router.post('/', protect, LeadController.createLead);

// Busca, atualização e exclusão por ID
router.get('/:id', protect, LeadController.getLeadById);
router.put('/:id', protect, LeadController.updateLead);
router.delete('/:id', protect, LeadController.deleteLead);

// Rota de reatribuição de usuários (transferência de lead)
router.get('/users/reassignment', protect, LeadController.getUsersForReassignment);

module.exports = router;
