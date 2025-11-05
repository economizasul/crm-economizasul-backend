// routes/leadRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const LeadController = require('../controllers/leadController');

router.use(protect);

router.route('/')
  .get(LeadController.getLeads)
  .post(LeadController.createLead);

router.route('/:id')
  .get(LeadController.getLeadById)
  .put(LeadController.updateLead)
  .delete(LeadController.deleteLead);

router.route('/users/reassignment')
  .get(LeadController.getUsersForReassignment);

router.route('/:id/reassign')
  .put(LeadController.reassignLead);

module.exports = router;