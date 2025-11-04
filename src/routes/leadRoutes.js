// routes/leadRoutes.js

const express = require('express');
const router = express.Router();
// O middleware 'protect' é essencial para garantir autenticação e req.user
const { protect } = require('../middleware/authMiddleware'); 

const { 
    createLead, 
    getAllLeads, 
    updateLead, 
    // 💡 NOVO: Importa a função de listar usuários
    getUsersForReassignment, 
    deleteLead, 
    getLeadById,
} = require('../src/controllers/leadController');

// Rotas principais de Leads
router.route('/')
    .get(protect, getAllLeads) 
    .post(protect, createLead); 

// Rotas por ID
router.route('/:id')
    .put(protect, updateLead) // Rota PUT para atualização
    .get(protect, getLeadById)
    .delete(protect, deleteLead); 

// 💡 NOVO: Rota para buscar usuários para a função de transferência (Reatribuição)
router.route('/users/reassignment')
    .get(protect, getUsersForReassignment); // Adicione um middleware de autorização (e.g., isAdmin) se desejar restringir

module.exports = router;