// routes/pipelineRoutes.js

const express = require('express');
const router = express.Router();
const PipelineController = require('../controllers/PipelineController');
const { protect } = require('../middleware/authMiddleware');

// Rota para promover um Lead (com um ID específico) a Cliente
// O método é POST, pois cria um novo registro em outra tabela (Clients)
router.post('/promote/:leadId', protect, PipelineController.promoteToClient);

module.exports = router;