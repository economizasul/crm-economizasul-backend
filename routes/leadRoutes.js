// src/routes/leadRoutes.js
const controller = require('../controllers/leadController');
console.log('Controller importado:', controller);

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

const { 
  createLead, 
  getAllLeads, 
  updateLead, 
  getUsersForReassignment, 
  deleteLead, 
  getLeadById 
} = require('../controllers/leadController');

// Rotas
router.route('/')
    .get(protect, getAllLeads)
    .post(protect, createLead);

router.route('/:id')
    .get(protect, getLeadById)
    .put(protect, updateLead)
    .delete(protect, deleteLead);

router.route('/users/reassignment')
    .get(protect, getUsersForReassignment);

module.exports = router;
