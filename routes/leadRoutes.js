// routes/leadRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// ✅ Importa o controller com todos os métodos já ligados
const LeadController = require('../controllers/leadController');

// Todas as rotas de leads exigem autenticação
router.use(protect);

// 🔹 CRUD principal
router.route('/')
  .get(LeadController.getLeads)
  .post(LeadController.createLead);

router.route('/:id')
  .get(LeadController.getLeadById)
  .put(LeadController.updateLead)
  .delete(LeadController.deleteLead);

// 🔹 Reatribuição de leads (somente Admin)
router.get('/users/reassignment', LeadController.getUsersForReassignment);
router.put('/:id/reassign', LeadController.reassignLead);

// 🔹 Notas de leads
router.get('/:id/notes', LeadController.getNotesByLead);
router.post('/:id/notes', LeadController.addNote);

module.exports = router;
