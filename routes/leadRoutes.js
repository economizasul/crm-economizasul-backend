// routes/leadRoutes.js

const express = require('express');
const router = express.Router();
const { createLead, getAllLeads } = require('../controllers/LeadController');
const { protect } = require('../middleware/authMiddleware'); // Importa o middleware de segurança

// -----------------------------------------------------------
// TODAS as rotas de Lead devem ser protegidas pelo Token JWT!
// -----------------------------------------------------------

// Rota para criar um novo Lead
router.post('/', protect, createLead); 

// Rota para listar todos os Leads
router.get('/', protect, getAllLeads);

module.exports = router;