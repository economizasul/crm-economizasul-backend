// routes/leadRoutes.js

const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { protect, admin } = require('../middleware/authMiddleware');

// Rotas de Leads - CRUD

// POST /api/leads - Cria um novo lead (apenas usuário logado)
router.post('/', protect, leadController.createLead);

// GET /api/leads - Lista leads (Admin vê todos, User vê apenas os seus)
router.get('/', protect, leadController.getAllLeads);

// GET /api/leads/:id - Detalhes de um lead
router.get('/:id', protect, leadController.getLeadById);

// PUT /api/leads/:id - Atualiza um lead (apenas Admin, ou User que é owner)
router.put('/:id', protect, leadController.updateLead);

// DELETE /api/leads/:id - Deleta um lead (apenas Admin)
router.delete('/:id', protect, admin, leadController.deleteLead);

module.exports = router;