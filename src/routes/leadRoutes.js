// src/routes/leadRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const { 
    createLead, 
    getAllLeads, 
    updateLead, 
    getUsersForReassignment, 
    deleteLead, 
    getLeadById,
} = require('../controllers/leadController');

// Rotas principais de Leads
router.route('/')
    .get(protect, getAllLeads)
    .post(protect, createLead);

// Rotas por ID
router.route('/:id')
    .get(protect, getLeadById)
    .put(protect, updateLead)
    .delete(protect, deleteLead);

// Rota para buscar usuários para reatribuição
router.route('/users/reassignment')
    .get(protect, getUsersForReassignment);

module.exports = router;
