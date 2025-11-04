// src/routes/leadRoutes.js

const express = require('express');
const router = express.Router();

// ✅ Middleware de autenticação
const { protect } = require('../middleware/authMiddleware');

// ✅ Controller (caminho correto)
const LeadController = require('../controllers/leadController');

// ===================================
// ROTAS DE LEADS
// ===================================

// Listar e criar leads
router.route('/')
  .get(protect, LeadController.getAllLeads)
  .post(protect, LeadController.createLead);

// Buscar, atualizar e deletar lead por ID
router.route('/:id')
  .get(protect, LeadController.getLeadById)
  .put(protect, LeadController.updateLead)
  .delete(protect, LeadController.deleteLead);

// Buscar usuários para reatribuição (transferência)
router.route('/users/reassignment')
  .get(protect, LeadController.getUsersForReassignment);

module.exports = router;
