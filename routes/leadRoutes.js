// routes/leadRoutes.js

const express = require('express');
const router = express.Router();
// O middleware 'protect' é essencial para garantir autenticação e req.user
const { protect } = require('../middleware/authMiddleware'); 

const { 
    createLead, 
    getAllLeads, 
    updateLead, // Importa a função de atualização
    // ... (Outras funções)
} = require('../controllers/leadController');

// Rotas principais de Leads
router.route('/')
    .get(protect, getAllLeads) 
    .post(protect, createLead); 

// Rotas por ID
router.route('/:id')
    .put(protect, updateLead) // Rota PUT para atualização
    // .delete(protect, deleteLead); // Se existir

// Outras rotas (se existirem)
// router.route('/:id/geocode').put(protect, geocodeAddress); 
// router.route('/:id/schedule').put(protect, scheduleAttendance);

module.exports = router;