// src/routes/leadRoutes.js

const express = require('express');
const router = express.Router();

// Middlewares
const { protect } = require('../middleware/authMiddleware');

// Controladores
const {
    createLead,
    getAllLeads,
    updateLead,
    getUsersForReassignment,
    deleteLead,
    getLeadById,
} = require('../controllers/leadController');

// ROTAS PRINCIPAIS DE LEADS
router.route('/')
    .get(protect, getAllLeads)
    .post(protect, createLead);

// ROTAS POR ID
router.route('/:id')
    .put(protect, updateLead)
    .get(protect, getLeadById)
    .delete(protect, deleteLead);

// ROTA PARA BUSCAR USUÁRIOS PARA REATRIBUIÇÃO
router.route('/users/reassignment')
    .get(protect, getUsersForReassignment);

module.exports = router;
