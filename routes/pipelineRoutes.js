// routes/pipelineRoutes.js

const express = require('express');
const router = express.Router();

// Controlador
const PipelineController = require('../controllers/PipelineController');

// Middleware
const { protect } = require('../middleware/authMiddleware');

// ROTA PARA PROMOVER UM LEAD A CLIENTE
router.post('/promote/:leadId', protect, PipelineController.promoteToClient);

module.exports = router;